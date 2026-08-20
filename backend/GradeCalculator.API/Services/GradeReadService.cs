using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using GradeCalculator.API.Data;
using GradeCalculator.API.DTOs.Responses;
using GradeCalculator.API.Grading;
using GradeCalculator.API.Models;
using GradeCalculator.API.Services.Interfaces;

namespace GradeCalculator.API.Services;

public sealed class GradeReadService : IGradeReadService
{
    private readonly AppDbContext _db;

    public GradeReadService(AppDbContext db) => _db = db;

    /// <summary>
    /// The canonical load for anything that will be graded.
    ///
    /// <c>AsSplitQuery</c> matters here: a class joined across categories, items and rules in one
    /// statement produces a cartesian explosion (categories x items x rules) that grows fast on
    /// a real gradebook. Split queries trade one round trip for a far smaller result set.
    /// <c>AsNoTracking</c> because these entities are never written back on a read path.
    /// </summary>
    private IQueryable<Class> GradableClasses(int userId) =>
        _db.Classes
            .AsNoTracking()
            .AsSplitQuery()
            .Where(c => c.UserId == userId)
            .Include(c => c.GradeScale)
            .Include(c => c.Categories).ThenInclude(cat => cat.GradeItems)
            .Include(c => c.Categories).ThenInclude(cat => cat.Rules);

    public async Task<ClassResponse> GetClassAsync(int classId, int userId, CancellationToken cancellationToken = default)
    {
        var entity = await GradableClasses(userId).FirstOrDefaultAsync(c => c.Id == classId, cancellationToken)
                     ?? throw new ResourceNotFoundException("Class", classId);

        return ToResponse(entity);
    }

    public async Task<List<ClassResponse>> GetClassesAsync(int userId, int? semesterId, CancellationToken cancellationToken = default)
    {
        var query = GradableClasses(userId);
        if (semesterId is not null) query = query.Where(c => c.SemesterId == semesterId);

        var entities = await query.OrderBy(c => c.Name).ThenBy(c => c.Id).ToListAsync(cancellationToken);

        return entities.Select(ToResponse).ToList();
    }

    public async Task<GpaResponse> GetGpaAsync(int userId, int? semesterId, CancellationToken cancellationToken = default)
    {
        var query = GradableClasses(userId);
        if (semesterId is not null) query = query.Where(c => c.SemesterId == semesterId);

        var evaluated = (await query.ToListAsync(cancellationToken))
            .Select(entity => GradeEngine.EvaluateClass(entity.ToInput()))
            .ToList();

        return new GpaResponse
        {
            OverallGpa = GradeEngine.AggregateGpa(evaluated),

            // Only classes that actually contribute to the GPA are counted, so the credit total
            // shown next to it always reconciles with the number above it.
            TotalCreditHours = evaluated.Where(c => c.Gpa is not null).Sum(c => c.CreditHours),

            Classes = evaluated.Select(c => new ClassGpaResponse
            {
                Id = c.Id,
                Name = c.Name,
                CreditHours = c.CreditHours,
                CurrentGrade = Display(c.Percent),
                LetterGrade = c.Letter,
                Gpa = c.Gpa,
            }).ToList(),
        };
    }

    public async Task<SemesterResponse> GetSemesterAsync(int semesterId, int userId, CancellationToken cancellationToken = default)
    {
        var semester = await _db.Semesters
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.Id == semesterId && s.UserId == userId, cancellationToken)
            ?? throw new ResourceNotFoundException("Semester", semesterId);

        var classes = await GetClassesAsync(userId, semesterId, cancellationToken);
        var cumulative = await GetCumulativeGpaAsync(userId, cancellationToken);

        return ToResponse(semester, classes, cumulative);
    }

    public async Task<List<SemesterResponse>> GetSemestersAsync(int userId, CancellationToken cancellationToken = default)
    {
        var semesters = await _db.Semesters
            .AsNoTracking()
            .Where(s => s.UserId == userId)
            .OrderByDescending(s => s.Year).ThenBy(s => s.Term).ThenBy(s => s.Id)
            .ToListAsync(cancellationToken);

        // One load for every class the user owns, then partitioned in memory. The alternative —
        // a query per semester — is a textbook N+1 on a page that renders every term at once.
        var allClasses = await GradableClasses(userId).ToListAsync(cancellationToken);

        var evaluatedAll = allClasses
            .Select(entity => (entity.SemesterId, Result: GradeEngine.EvaluateClass(entity.ToInput()), Entity: entity))
            .ToList();

        var cumulative = GradeEngine.AggregateGpa(evaluatedAll.Select(x => x.Result));

        return semesters.Select(semester =>
        {
            var forSemester = evaluatedAll
                .Where(x => x.SemesterId == semester.Id)
                .Select(x => ToResponse(x.Entity, x.Result))
                .OrderBy(c => c.Name)
                .ToList();

            return ToResponse(semester, forSemester, cumulative);
        }).ToList();
    }

    public async Task<decimal?> GetCumulativeGpaAsync(int userId, CancellationToken cancellationToken = default)
    {
        var evaluated = (await GradableClasses(userId).ToListAsync(cancellationToken))
            .Select(entity => GradeEngine.EvaluateClass(entity.ToInput()));

        return GradeEngine.AggregateGpa(evaluated);
    }

    public async Task<TargetGradeResponse> GetTargetAsync(int classId, int userId, string targetLetter, CancellationToken cancellationToken = default)
    {
        if (!GradeBands.IsValidLetter(targetLetter))
            throw new ValidationFailedException($"'{targetLetter}' is not a letter grade.");

        var entity = await GradableClasses(userId).FirstOrDefaultAsync(c => c.Id == classId, cancellationToken)
                     ?? throw new ResourceNotFoundException("Class", classId);

        var result = TargetGradeSolver.Solve(entity.ToInput(), targetLetter);

        return new TargetGradeResponse
        {
            ClassName = entity.Name,
            TargetGrade = result.TargetLetter,
            TargetPercentage = result.TargetPercent,
            Status = result.Status.ToString(),
            IsAchievable = result.IsAchievable,
            CurrentGrade = Display(result.CurrentPercent),
            CurrentLetter = result.CurrentLetter,
            NeededOnRemaining = result.NeededOnRemaining,
            RemainingPointsPossible = result.RemainingPointsPossible,
            Summary = Summarise(result),
            Categories = result.Categories.Select(c => new TargetCategoryResponse
            {
                CategoryName = c.Name,
                Weight = c.Weight,
                CurrentGrade = Display(c.CurrentPercent),
                GradedItems = c.GradedItemCount,
                TotalItems = c.TotalItemCount,
                IsComplete = c.IsComplete,
            }).ToList(),
        };
    }

    // -----------------------------------------------------------------------
    // Mapping
    // -----------------------------------------------------------------------

    private static ClassResponse ToResponse(Class entity) =>
        ToResponse(entity, GradeEngine.EvaluateClass(entity.ToInput()));

    private static ClassResponse ToResponse(Class entity, ClassResult result)
    {
        var byId = result.Categories.ToDictionary(c => c.Id);

        return new ClassResponse
        {
            Id = entity.Id,
            Name = entity.Name,
            CreditHours = entity.CreditHours,
            ShowOnlyCAndUp = entity.ShowOnlyCAndUp,
            SemesterId = entity.SemesterId,
            CurrentGrade = Display(result.Percent),
            LetterGrade = result.Letter,
            Gpa = result.Gpa,
            Warnings = result.Warnings.Select(w => w.ToString()).ToList(),
            GradeScale = ToResponse(entity.GradeScale ?? GradeScale.Default(entity.Id)),
            Categories = entity.Categories
                .OrderBy(c => c.SortOrder).ThenBy(c => c.Id)
                .Select(category =>
                {
                    var graded = byId.GetValueOrDefault(category.Id);

                    return new CategoryResponse
                    {
                        Id = category.Id,
                        Name = category.Name,
                        Weight = category.Weight,
                        CurrentGrade = Display(graded?.Percent),
                        CountedItemCount = graded?.CountedItemCount ?? 0,
                        GradeItems = category.GradeItems
                            .OrderBy(i => i.SortOrder).ThenBy(i => i.Id)
                            .Select(ToResponse)
                            .ToList(),
                        Rules = category.Rules.OrderBy(r => r.Id).Select(ToResponse).ToList(),
                    };
                })
                .ToList(),
        };
    }

    private static GradeItemResponse ToResponse(GradeItem item)
    {
        var input = item.ToInput();

        return new GradeItemResponse
        {
            Id = item.Id,
            Name = item.Name,
            PointsEarned = item.PointsEarned,
            PointsPossible = item.PointsPossible,
            Percentage = input.IsGraded ? Display(input.Percent) : null,
            IsWhatIf = item.IsWhatIf,
            SortOrder = item.SortOrder,
        };
    }

    private static RuleResponse ToResponse(Rule rule) => new()
    {
        Id = rule.Id,
        Type = rule.Type.ToString(),
        Value = rule.Value,
        WeightDistribution = TryParseWeights(rule.WeightDistribution),
    };

    private static GradeScaleResponse ToResponse(GradeScale scale) => new()
    {
        APlusGpaValue = scale.APlusGpaValue,
        APlus = scale.APlus,
        A = scale.A,
        AMinus = scale.AMinus,
        BPlus = scale.BPlus,
        B = scale.B,
        BMinus = scale.BMinus,
        CPlus = scale.CPlus,
        C = scale.C,
        CMinus = scale.CMinus,
        DPlus = scale.DPlus,
        D = scale.D,
        DMinus = scale.DMinus,
    };

    private static SemesterResponse ToResponse(Semester semester, List<ClassResponse> classes, decimal? cumulative)
    {
        var semesterGpa = GradeEngine.AggregateGpa(classes.Select(c => (c.Gpa, c.CreditHours)));

        return new SemesterResponse
        {
            Id = semester.Id,
            Name = semester.Name,
            Year = semester.Year,
            Term = semester.Term,
            GpaGoal = semester.GpaGoal,
            SemesterGpa = semesterGpa,
            CumulativeGpa = cumulative,
            GpaGoalProgress = GoalProgress(semesterGpa, semester.GpaGoal),
            ClassCount = classes.Count,
            Classes = classes,
            CreatedAt = semester.CreatedAt,
        };
    }

    /// <summary>Progress toward a GPA goal as a 0..1 ratio, capped so the bar cannot overflow.</summary>
    private static decimal? GoalProgress(decimal? current, decimal? goal)
    {
        if (current is null || goal is null || goal <= 0m) return null;
        return Math.Min(current.Value / goal.Value, 1.0m);
    }

    /// <summary>
    /// Rounds a percentage for transport. The engine works unrounded end to end; this is the
    /// display boundary, and 2 dp is finer than any gradebook reports while staying stable
    /// across the JSON round trip.
    /// </summary>
    private static decimal? Display(decimal? percent) =>
        percent is null ? null : Math.Round(percent.Value, 2, MidpointRounding.AwayFromZero);

    private static List<decimal>? TryParseWeights(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;

        try
        {
            return JsonSerializer.Deserialize<List<decimal>>(json);
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static string Summarise(TargetResult result) => result.Status switch
    {
        TargetStatus.Determined =>
            $"Everything is graded. Final grade: {Display(result.CurrentPercent)}% " +
            $"({result.CurrentLetter}). A {result.TargetLetter} needs {result.TargetPercent}%.",

        TargetStatus.Secured =>
            $"A {result.TargetLetter} is already locked in — you would keep it even if you scored " +
            $"0% on everything remaining.",

        TargetStatus.Achievable =>
            $"You need {result.NeededOnRemaining}% on the remaining {result.RemainingPointsPossible} " +
            $"points to earn a {result.TargetLetter}.",

        TargetStatus.Unreachable when result.NeededOnRemaining is not null =>
            $"A {result.TargetLetter} ({result.TargetPercent}%) is out of reach: it would take " +
            $"{result.NeededOnRemaining}% on the remaining work, and only 100% is available.",

        _ =>
            $"A {result.TargetLetter} ({result.TargetPercent}%) is no longer reachable with the " +
            $"work that remains.",
    };
}
