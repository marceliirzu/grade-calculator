using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using GradeCalculator.API.Data;
using GradeCalculator.API.DTOs.Requests;
using GradeCalculator.API.DTOs.Responses;
using GradeCalculator.API.Models;
using GradeCalculator.API.Services.Interfaces;

namespace GradeCalculator.API.Services;

public class GradeAdvisorService : IGradeAdvisorService
{
    private readonly IOpenAiService _openAiService;
    private readonly AppDbContext _context;
    private readonly IGpaCalculatorService _gpaCalculator;
    private readonly ILogger<GradeAdvisorService> _logger;

    public GradeAdvisorService(
        IOpenAiService openAiService,
        AppDbContext context,
        IGpaCalculatorService gpaCalculator,
        ILogger<GradeAdvisorService> logger)
    {
        _openAiService = openAiService;
        _context = context;
        _gpaCalculator = gpaCalculator;
        _logger = logger;
    }

    public async Task<ChatResponse> ChatAsync(int userId, ChatRequest request)
    {
        var systemPrompt = @"You are a Grade Advisor for a student GPA calculator app.
You help students understand their academic performance and plan for success.

You have access to tools to retrieve the student's grade data and perform calculations.
Always use get_grade_context first to understand the student's current situation before answering.
Be encouraging, specific, and actionable. Format numbers clearly (e.g., ""You need an 87% on the final"").
Keep responses concise (2-4 sentences) unless detailed analysis is requested.";

        var tools = new List<ToolDefinition>
        {
            new()
            {
                Name = "get_grade_context",
                Description = "Retrieves the student's complete grade data including all semesters, classes, categories, and grades. Always call this first.",
                Parameters = new
                {
                    type = "object",
                    properties = new { },
                    required = Array.Empty<string>()
                }
            },
            new()
            {
                Name = "calculate_needed_score",
                Description = "Calculates what score a student needs on remaining graded items to achieve a target letter grade in a specific class.",
                Parameters = new
                {
                    type = "object",
                    properties = new
                    {
                        classId = new { type = "integer", description = "The ID of the class" },
                        targetGrade = new { type = "string", description = "Target letter grade (e.g., 'A', 'B+', 'C')" }
                    },
                    required = new[] { "classId", "targetGrade" }
                }
            },
            new()
            {
                Name = "calculate_what_if_gpa",
                Description = "Calculates what the semester GPA would be if a student received a specific grade in a class.",
                Parameters = new
                {
                    type = "object",
                    properties = new
                    {
                        classId = new { type = "integer", description = "The ID of the class" },
                        hypotheticalGrade = new { type = "string", description = "The hypothetical letter grade (e.g., 'A', 'B', 'C+')" }
                    },
                    required = new[] { "classId", "hypotheticalGrade" }
                }
            }
        };

        // Build updated history including new user message
        var updatedHistory = new List<ChatMessageDto>(request.History)
        {
            new() { Role = "user", Content = request.Message }
        };

        // Call OpenAI with function calling
        var assistantResponse = await _openAiService.GetCompletionWithToolsAsync(
            systemPrompt,
            updatedHistory,
            tools,
            (functionName, args) => ExecuteToolAsync(userId, request.SemesterId, functionName, args));

        // Add assistant response to history
        updatedHistory.Add(new ChatMessageDto { Role = "assistant", Content = assistantResponse });

        return new ChatResponse
        {
            Message = assistantResponse,
            UpdatedHistory = updatedHistory
        };
    }

    private async Task<string> ExecuteToolAsync(int userId, int? semesterId, string functionName, string args)
    {
        _logger.LogInformation("Executing tool: {FunctionName} with args: {Args}", functionName, args);

        switch (functionName)
        {
            case "get_grade_context":
                return await GetGradeContextAsync(userId, semesterId);

            case "calculate_needed_score":
            {
                var parsed = JsonDocument.Parse(args).RootElement;
                var classId = parsed.GetProperty("classId").GetInt32();
                var targetGrade = parsed.GetProperty("targetGrade").GetString() ?? "A";
                return await CalculateNeededScoreAsync(userId, classId, targetGrade);
            }

            case "calculate_what_if_gpa":
            {
                var parsed = JsonDocument.Parse(args).RootElement;
                var classId = parsed.GetProperty("classId").GetInt32();
                var hypotheticalGrade = parsed.GetProperty("hypotheticalGrade").GetString() ?? "A";
                return await CalculateWhatIfGpaAsync(userId, classId, hypotheticalGrade);
            }

            default:
                return $"Unknown tool: {functionName}";
        }
    }

    private async Task<string> GetGradeContextAsync(int userId, int? semesterId)
    {
        // RAG: retrieve all user data from the database
        var semesters = await _context.Semesters
            .Include(s => s.Classes)
                .ThenInclude(c => c.GradeScale)
            .Include(s => s.Classes)
                .ThenInclude(c => c.Categories)
                    .ThenInclude(cat => cat.GradeItems)
            .Include(s => s.Classes)
                .ThenInclude(c => c.Categories)
                    .ThenInclude(cat => cat.Rules)
            .Where(s => s.UserId == userId)
            .OrderByDescending(s => s.Year)
            .ToListAsync();

        // Also get classes without a semester
        var unsortedClasses = await _context.Classes
            .Include(c => c.GradeScale)
            .Include(c => c.Categories).ThenInclude(cat => cat.GradeItems)
            .Include(c => c.Categories).ThenInclude(cat => cat.Rules)
            .Where(c => c.UserId == userId && c.SemesterId == null)
            .ToListAsync();

        var sb = new StringBuilder();
        sb.AppendLine("STUDENT GRADE DATA:");

        var allSemesterClasses = semesters.Select(s => s.Classes.AsEnumerable()).ToList();
        var cumulativeGpa = _gpaCalculator.CalculateCumulativeGpa(allSemesterClasses);
        if (cumulativeGpa.HasValue)
            sb.AppendLine($"Cumulative GPA: {cumulativeGpa:F2}");

        foreach (var semester in semesters)
        {
            if (semesterId.HasValue && semester.Id != semesterId.Value) continue;

            var semGpa = _gpaCalculator.CalculateSemesterGpa(semester.Classes);
            sb.AppendLine($"\nSemester: {semester.Name} (ID: {semester.Id})");
            if (semester.GpaGoal.HasValue) sb.AppendLine($"  GPA Goal: {semester.GpaGoal:F2}");
            if (semGpa.HasValue) sb.AppendLine($"  Current Semester GPA: {semGpa:F2}");

            foreach (var cls in semester.Classes)
            {
                AppendClassContext(sb, cls);
            }
        }

        if (unsortedClasses.Any())
        {
            sb.AppendLine("\nClasses (no semester):");
            foreach (var cls in unsortedClasses) AppendClassContext(sb, cls);
        }

        return sb.ToString();
    }

    private void AppendClassContext(StringBuilder sb, Class cls)
    {
        var classGrade = _gpaCalculator.CalculateClassGrade(cls);
        var classGpa = _gpaCalculator.CalculateClassGpa(cls);
        var letterGrade = classGrade.HasValue && cls.GradeScale != null
            ? cls.GradeScale.GetLetterGrade(classGrade.Value)
            : null;

        sb.AppendLine($"  Class: {cls.Name} (ID: {cls.Id}, {cls.CreditHours} credits)");
        if (classGrade.HasValue)
            sb.AppendLine($"    Current Grade: {classGrade:F1}% ({letterGrade ?? "?"}) | GPA: {classGpa:F2}");
        else
            sb.AppendLine("    Current Grade: No grades yet");

        foreach (var cat in cls.Categories)
        {
            var catGrade = _gpaCalculator.CalculateCategoryGrade(cat);
            var gradedItems = cat.GradeItems.Count(g => g.PointsEarned.HasValue);
            var totalItems = cat.GradeItems.Count;
            sb.AppendLine($"    Category: {cat.Name} ({cat.Weight}% weight) — {gradedItems}/{totalItems} graded" +
                          (catGrade.HasValue ? $" | {catGrade:F1}%" : " | No grades yet"));
        }
    }

    private async Task<string> CalculateNeededScoreAsync(int userId, int classId, string targetGrade)
    {
        var cls = await _context.Classes
            .Include(c => c.GradeScale)
            .Include(c => c.Categories).ThenInclude(cat => cat.GradeItems)
            .Include(c => c.Categories).ThenInclude(cat => cat.Rules)
            .FirstOrDefaultAsync(c => c.Id == classId && c.UserId == userId);

        if (cls == null) return "Class not found.";
        if (cls.GradeScale == null) return "Class has no grade scale set up.";

        // Get target percentage from letter grade
        var targetPct = GetMinPercentageForGrade(cls.GradeScale, targetGrade);
        if (targetPct == null) return $"Unknown target grade: {targetGrade}";

        // Calculate current weighted grade from categories that have grades
        decimal currentWeightedSum = 0;
        decimal gradedWeight = 0;
        decimal ungradedWeight = 0;

        foreach (var cat in cls.Categories)
        {
            var catGrade = _gpaCalculator.CalculateCategoryGrade(cat);
            var ungradedInCat = cat.GradeItems.Any(g => !g.PointsEarned.HasValue);
            var hasAnyGrades = cat.GradeItems.Any(g => g.PointsEarned.HasValue);

            if (catGrade.HasValue)
            {
                currentWeightedSum += catGrade.Value * (cat.Weight / 100m);
                if (!ungradedInCat) gradedWeight += cat.Weight;
                else { gradedWeight += cat.Weight / 2; ungradedWeight += cat.Weight / 2; }
            }
            else
            {
                ungradedWeight += cat.Weight;
            }
        }

        if (ungradedWeight == 0)
            return $"All assignments are graded. Current grade: {currentWeightedSum:F1}%. Target {targetGrade} requires {targetPct:F1}%.";

        // needed = (target - currentWeightedSum) / (ungradedWeight/100)
        var needed = (targetPct.Value - currentWeightedSum) / (ungradedWeight / 100m);
        needed = Math.Round(needed, 1);

        if (needed > 100)
            return $"To get a {targetGrade}, you would need {needed:F1}% on remaining work — this may not be achievable. Current: {currentWeightedSum:F1}%.";
        if (needed < 0)
            return $"You have already secured at least a {targetGrade}! Current grade: {currentWeightedSum:F1}%.";

        return $"To earn a {targetGrade} in {cls.Name}, you need approximately {needed:F1}% on your remaining graded work (which counts for {ungradedWeight:F0}% of your grade). Current weighted total: {currentWeightedSum:F1}%.";
    }

    private decimal? GetMinPercentageForGrade(GradeScale scale, string grade)
    {
        return grade.ToUpper() switch
        {
            "A+" => scale.APlus,
            "A" => scale.A,
            "A-" => scale.AMinus,
            "B+" => scale.BPlus,
            "B" => scale.B,
            "B-" => scale.BMinus,
            "C+" => scale.CPlus,
            "C" => scale.C,
            "C-" => scale.CMinus,
            "D+" => scale.DPlus,
            "D" => scale.D,
            "D-" => scale.DMinus,
            _ => null
        };
    }

    private async Task<string> CalculateWhatIfGpaAsync(int userId, int classId, string hypotheticalGrade)
    {
        // Get the specific class
        var cls = await _context.Classes
            .Include(c => c.GradeScale)
            .FirstOrDefaultAsync(c => c.Id == classId && c.UserId == userId);

        if (cls == null) return "Class not found.";

        // Get all classes in the same semester
        var allClasses = await _context.Classes
            .Include(c => c.GradeScale)
            .Include(c => c.Categories).ThenInclude(cat => cat.GradeItems)
            .Include(c => c.Categories).ThenInclude(cat => cat.Rules)
            .Where(c => c.UserId == userId && c.SemesterId == cls.SemesterId)
            .ToListAsync();

        // Calculate GPA for all OTHER classes normally
        decimal totalQualityPoints = 0;
        int totalCredits = 0;

        foreach (var c in allClasses)
        {
            if (c.Id == classId)
            {
                // Use hypothetical grade with inline mapping
                var hypotheticalGpaPoints = hypotheticalGrade.ToUpper() switch
                {
                    "A+" => 4.33m, "A" => 4.0m, "A-" => 3.67m,
                    "B+" => 3.33m, "B" => 3.0m, "B-" => 2.67m,
                    "C+" => 2.33m, "C" => 2.0m, "C-" => 1.67m,
                    "D+" => 1.33m, "D" => 1.0m, "D-" => 0.67m,
                    _ => 0.0m
                };
                totalQualityPoints += hypotheticalGpaPoints * c.CreditHours;
                totalCredits += c.CreditHours;
            }
            else
            {
                var gpa = _gpaCalculator.CalculateClassGpa(c);
                if (gpa.HasValue)
                {
                    totalQualityPoints += gpa.Value * c.CreditHours;
                    totalCredits += c.CreditHours;
                }
            }
        }

        if (totalCredits == 0) return "No classes with grades found.";

        var projectedGpa = Math.Round(totalQualityPoints / totalCredits, 2);
        return $"If you get a {hypotheticalGrade} in {cls.Name}, your semester GPA would be approximately {projectedGpa:F2}.";
    }
}
