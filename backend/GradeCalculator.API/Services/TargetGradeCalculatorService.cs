using Microsoft.EntityFrameworkCore;
using GradeCalculator.API.Data;
using GradeCalculator.API.Models;
using GradeCalculator.API.Services.Interfaces;

namespace GradeCalculator.API.Services;

public class TargetGradeCalculatorService : ITargetGradeCalculatorService
{
    private readonly AppDbContext _context;
    private readonly IGpaCalculatorService _gpaCalculator;

    public TargetGradeCalculatorService(AppDbContext context, IGpaCalculatorService gpaCalculator)
    {
        _context = context;
        _gpaCalculator = gpaCalculator;
    }

    public async Task<TargetGradeResult> CalculateTargetAsync(int classId, string targetLetterGrade, int userId)
    {
        var cls = await _context.Classes
            .Include(c => c.GradeScale)
            .Include(c => c.Categories)
                .ThenInclude(cat => cat.GradeItems)
            .Include(c => c.Categories)
                .ThenInclude(cat => cat.Rules)
            .FirstOrDefaultAsync(c => c.Id == classId && c.UserId == userId)
            ?? throw new InvalidOperationException("Class not found");

        if (cls.GradeScale == null)
            throw new InvalidOperationException("Class has no grade scale");

        var targetPct = GetMinPctForGrade(cls.GradeScale, targetLetterGrade);
        var currentGrade = _gpaCalculator.CalculateClassGrade(cls) ?? 0m;

        var categoryResults = new List<CategoryTargetResult>();
        decimal currentWeightedTotal = 0;
        decimal ungradedWeight = 0;

        foreach (var cat in cls.Categories)
        {
            var catGrade = _gpaCalculator.CalculateCategoryGrade(cat);
            var gradedItems = cat.GradeItems.Count(g => g.PointsEarned.HasValue);
            var totalItems = cat.GradeItems.Count;
            var hasUngraded = cat.GradeItems.Any(g => !g.PointsEarned.HasValue);

            if (catGrade.HasValue)
                currentWeightedTotal += catGrade.Value * (cat.Weight / 100m);

            decimal? neededOnRemaining = null;
            bool isComplete = !hasUngraded && totalItems > 0;

            if (hasUngraded && catGrade.HasValue)
            {
                // What does the whole category need to average to hit the class target?
                // simplified: same needed score across remaining items
                var ungradedPossible = cat.GradeItems.Where(g => !g.PointsEarned.HasValue).Sum(g => g.PointsPossible);
                var gradedEarned = cat.GradeItems.Where(g => g.PointsEarned.HasValue).Sum(g => g.PointsEarned!.Value);
                var gradedPossible = cat.GradeItems.Where(g => g.PointsEarned.HasValue).Sum(g => g.PointsPossible);

                // neededPct at category level to achieve target overall
                var catNeededPct = (targetPct - (currentWeightedTotal + (catGrade.Value * (cat.Weight / 100m) - (gradedEarned / gradedPossible * 100m) * (cat.Weight / 100m))))
                                   / (cat.Weight / 100m);
                // Simpler: how many points needed on remaining to get catNeededPct average overall
                neededOnRemaining = Math.Max(0, Math.Min(100, catNeededPct));
            }
            else if (!catGrade.HasValue && totalItems > 0)
            {
                ungradedWeight += cat.Weight;
            }

            categoryResults.Add(new CategoryTargetResult
            {
                CategoryName = cat.Name,
                Weight = cat.Weight,
                CurrentGrade = catGrade,
                GradedItems = gradedItems,
                TotalItems = totalItems,
                NeededScoreOnRemaining = neededOnRemaining,
                IsComplete = isComplete
            });
        }

        // Overall needed on remaining
        decimal? overallNeeded = null;
        if (ungradedWeight > 0 || cls.Categories.Any(c => c.GradeItems.Any(g => !g.PointsEarned.HasValue)))
        {
            var totalUngradedWeight = cls.Categories
                .Where(c => c.GradeItems.Any(g => !g.PointsEarned.HasValue) || !c.GradeItems.Any())
                .Sum(c => c.Weight);
            if (totalUngradedWeight > 0)
            {
                overallNeeded = (targetPct - currentWeightedTotal) / (totalUngradedWeight / 100m);
            }
        }

        var isAchievable = overallNeeded == null || overallNeeded <= 100;
        string summary;
        if (overallNeeded == null)
            summary = $"All graded. Current: {currentGrade:F1}%. Target {targetLetterGrade} requires {targetPct:F1}%.";
        else if (!isAchievable)
            summary = $"A {targetLetterGrade} ({targetPct:F1}%) is no longer achievable. You need {overallNeeded:F1}% on remaining work but max is 100%.";
        else if (overallNeeded < 0)
            summary = $"You have already secured a {targetLetterGrade}! Current grade: {currentGrade:F1}%.";
        else
            summary = $"You need approximately {overallNeeded:F1}% on remaining work to earn a {targetLetterGrade}.";

        return new TargetGradeResult
        {
            ClassName = cls.Name,
            TargetGrade = targetLetterGrade,
            TargetPercentage = targetPct,
            CurrentGrade = currentGrade,
            IsAchievable = isAchievable,
            Summary = summary,
            Categories = categoryResults
        };
    }

    private decimal GetMinPctForGrade(GradeScale scale, string grade) =>
        grade.ToUpper() switch
        {
            "A+" => scale.APlus, "A" => scale.A, "A-" => scale.AMinus,
            "B+" => scale.BPlus, "B" => scale.B, "B-" => scale.BMinus,
            "C+" => scale.CPlus, "C" => scale.C, "C-" => scale.CMinus,
            "D+" => scale.DPlus, "D" => scale.D, "D-" => scale.DMinus,
            _ => 60
        };
}
