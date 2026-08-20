namespace GradeCalculator.API.DTOs.Responses;

/// <summary>
/// Uniform envelope for every endpoint. Kept because the browser client branches on
/// <see cref="Success"/> everywhere; errors additionally carry a real HTTP status code and a
/// ProblemDetails-shaped body from the exception middleware.
/// </summary>
public class ApiResponse<T>
{
    public bool Success { get; set; }
    public string? Message { get; set; }
    public T? Data { get; set; }

    /// <summary>Non-fatal grading warnings, e.g. a weight-by-score rule that no longer lines up.</summary>
    public List<string>? Warnings { get; set; }

    public static ApiResponse<T> Ok(T data, string? message = null, List<string>? warnings = null) => new()
    {
        Success = true,
        Message = message,
        Data = data,
        Warnings = warnings is { Count: > 0 } ? warnings : null,
    };

    public static ApiResponse<T> Fail(string message) => new()
    {
        Success = false,
        Message = message,
        Data = default,
    };
}

public class ClassResponse
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public decimal CreditHours { get; set; }
    public bool ShowOnlyCAndUp { get; set; }
    public decimal? CurrentGrade { get; set; }
    public string? LetterGrade { get; set; }
    public decimal? Gpa { get; set; }
    public int? SemesterId { get; set; }
    public List<CategoryResponse> Categories { get; set; } = new();
    public GradeScaleResponse? GradeScale { get; set; }
    public List<string> Warnings { get; set; } = new();
}

public class CategoryResponse
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public decimal Weight { get; set; }
    public decimal? CurrentGrade { get; set; }

    /// <summary>How many items survived drop/count rules — lets the UI say "best 8 of 10".</summary>
    public int CountedItemCount { get; set; }

    public List<GradeItemResponse> GradeItems { get; set; } = new();
    public List<RuleResponse> Rules { get; set; } = new();
}

public class GradeItemResponse
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public decimal? PointsEarned { get; set; }
    public decimal PointsPossible { get; set; }
    public decimal? Percentage { get; set; }
    public bool IsWhatIf { get; set; }
    public int SortOrder { get; set; }
}

public class RuleResponse
{
    public int Id { get; set; }
    public string Type { get; set; } = string.Empty;
    public int Value { get; set; }
    public List<decimal>? WeightDistribution { get; set; }
}

public class GradeScaleResponse
{
    public decimal APlusGpaValue { get; set; }
    public decimal APlus { get; set; }
    public decimal A { get; set; }
    public decimal AMinus { get; set; }
    public decimal BPlus { get; set; }
    public decimal B { get; set; }
    public decimal BMinus { get; set; }
    public decimal CPlus { get; set; }
    public decimal C { get; set; }
    public decimal CMinus { get; set; }
    public decimal DPlus { get; set; }
    public decimal D { get; set; }
    public decimal DMinus { get; set; }
}

public class GpaResponse
{
    public decimal? OverallGpa { get; set; }
    public decimal TotalCreditHours { get; set; }
    public List<ClassGpaResponse> Classes { get; set; } = new();
}

public class ClassGpaResponse
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public decimal CreditHours { get; set; }
    public decimal? CurrentGrade { get; set; }
    public string? LetterGrade { get; set; }
    public decimal? Gpa { get; set; }
}

public class SemesterResponse
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public int Year { get; set; }
    public string Term { get; set; } = string.Empty;
    public decimal? GpaGoal { get; set; }
    public decimal? SemesterGpa { get; set; }
    public decimal? CumulativeGpa { get; set; }

    /// <summary>Progress toward the goal as a 0..1 ratio, or null when either side is unknown.</summary>
    public decimal? GpaGoalProgress { get; set; }

    public int ClassCount { get; set; }
    public List<ClassResponse> Classes { get; set; } = new();
    public DateTime CreatedAt { get; set; }
}

// ---- Target grade ----

public class TargetGradeResponse
{
    public string ClassName { get; set; } = string.Empty;
    public string TargetGrade { get; set; } = string.Empty;
    public decimal TargetPercentage { get; set; }

    /// <summary>Determined | Secured | Achievable | Unreachable — see GRADING_SPEC.md §9.</summary>
    public string Status { get; set; } = string.Empty;

    public bool IsAchievable { get; set; }
    public decimal? CurrentGrade { get; set; }
    public string? CurrentLetter { get; set; }

    /// <summary>Uniform percentage needed on every remaining item. Null when nothing remains.</summary>
    public decimal? NeededOnRemaining { get; set; }

    public decimal RemainingPointsPossible { get; set; }
    public string Summary { get; set; } = string.Empty;
    public List<TargetCategoryResponse> Categories { get; set; } = new();
}

public class TargetCategoryResponse
{
    public string CategoryName { get; set; } = string.Empty;
    public decimal Weight { get; set; }
    public decimal? CurrentGrade { get; set; }
    public int GradedItems { get; set; }
    public int TotalItems { get; set; }
    public bool IsComplete { get; set; }
}

// ---- Syllabus parsing ----

public class SyllabusParseResponse
{
    public string? ClassName { get; set; }
    public decimal? CreditHours { get; set; }
    public List<ParsedCategory> Categories { get; set; } = new();
    public ParsedGradeScale? GradeScale { get; set; }

    /// <summary>
    /// Total points in the course, when the syllabus was point-based. Informational: the
    /// categories and grade scale above are already normalised to percentages.
    /// </summary>
    public decimal? TotalPoints { get; set; }

    /// <summary>"deterministic" | "cache" | "llm" — surfaced so the UI can say how it was parsed.</summary>
    public string Source { get; set; } = "deterministic";

    /// <summary>Tokens this particular request spent. Zero for deterministic and cached parses.</summary>
    public int TokensUsed { get; set; }

    public List<string> Notes { get; set; } = new();
}

public class ParsedCategory
{
    public string Name { get; set; } = string.Empty;
    public decimal Weight { get; set; }
}

public class ParsedGradeScale
{
    public decimal? APlus { get; set; }
    public decimal? A { get; set; }
    public decimal? AMinus { get; set; }
    public decimal? BPlus { get; set; }
    public decimal? B { get; set; }
    public decimal? BMinus { get; set; }
    public decimal? CPlus { get; set; }
    public decimal? C { get; set; }
    public decimal? CMinus { get; set; }
    public decimal? DPlus { get; set; }
    public decimal? D { get; set; }
    public decimal? DMinus { get; set; }
}

// ---- Grade advisor ----

public class ChatMessageDto
{
    /// <summary>"user" or "assistant".</summary>
    public string Role { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
}

public class ChatResponse
{
    public string Message { get; set; } = string.Empty;
    public List<ChatMessageDto> UpdatedHistory { get; set; } = new();
    public int TokensUsed { get; set; }
}

// ---- Account / usage ----

public class MeResponse
{
    public int Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}

public class LlmQuotaResponse
{
    public int TokensUsedToday { get; set; }
    public int DailyTokenLimit { get; set; }
    public int TokensRemaining { get; set; }

    /// <summary>Tokens avoided by the deterministic parser and the shared parse cache.</summary>
    public int TokensSavedToday { get; set; }

    public bool LlmConfigured { get; set; }
}
