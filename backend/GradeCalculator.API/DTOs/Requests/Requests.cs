using System.ComponentModel.DataAnnotations;

namespace GradeCalculator.API.DTOs.Requests;

// Every bound field is range-checked here rather than in controllers. Model validation runs
// before the action body, so a malformed payload never reaches the grading engine or the
// database — which is what keeps the engine free of defensive clamping.

public class CreateClassRequest
{
    [Required, StringLength(200, MinimumLength = 1)]
    public string Name { get; set; } = string.Empty;

    /// <summary>Fractional credits are real (1.5-credit labs), so this is not an integer.</summary>
    [Range(0.0, 24.0)]
    public decimal CreditHours { get; set; } = 3m;

    public bool ShowOnlyCAndUp { get; set; }

    public int? SemesterId { get; set; }
}

public class UpdateClassRequest
{
    [Required, StringLength(200, MinimumLength = 1)]
    public string Name { get; set; } = string.Empty;

    [Range(0.0, 24.0)]
    public decimal CreditHours { get; set; } = 3m;

    public bool ShowOnlyCAndUp { get; set; }

    public int? SemesterId { get; set; }
}

public class CreateCategoryRequest
{
    [Required]
    public int ClassId { get; set; }

    [Required, StringLength(200, MinimumLength = 1)]
    public string Name { get; set; } = string.Empty;

    [Range(0.0, 100.0)]
    public decimal Weight { get; set; }

    public int? SortOrder { get; set; }
}

public class UpdateCategoryRequest
{
    [StringLength(200, MinimumLength = 1)]
    public string? Name { get; set; }

    [Range(0.0, 100.0)]
    public decimal? Weight { get; set; }

    public int? SortOrder { get; set; }
}

public class CreateGradeRequest
{
    [Required]
    public int CategoryId { get; set; }

    [Required, StringLength(200, MinimumLength = 1)]
    public string Name { get; set; } = string.Empty;

    /// <summary>Null means "not graded yet". Negative scores are rejected; over 100% is allowed.</summary>
    [Range(0.0, 1000000.0)]
    public decimal? PointsEarned { get; set; }

    [Range(0.0, 1000000.0)]
    public decimal PointsPossible { get; set; } = 100m;

    public bool IsWhatIf { get; set; }

    public int? SortOrder { get; set; }
}

public class UpdateGradeRequest
{
    [StringLength(200, MinimumLength = 1)]
    public string? Name { get; set; }

    [Range(0.0, 1000000.0)]
    public decimal? PointsEarned { get; set; }

    /// <summary>
    /// Present-but-null is how the client clears a score back to "not graded yet"; this flag
    /// distinguishes that from the field simply being absent from the payload.
    /// </summary>
    public bool ClearPointsEarned { get; set; }

    [Range(0.0, 1000000.0)]
    public decimal? PointsPossible { get; set; }

    public bool? IsWhatIf { get; set; }

    public int? SortOrder { get; set; }
}

public class UpdateGradeScaleRequest
{
    /// <summary>4.0 or 4.33.</summary>
    [Range(4.0, 4.33)]
    public decimal APlusGpaValue { get; set; } = 4.0m;

    [Range(0.0, 100.0)] public decimal APlus { get; set; } = 97m;
    [Range(0.0, 100.0)] public decimal A { get; set; } = 93m;
    [Range(0.0, 100.0)] public decimal AMinus { get; set; } = 90m;
    [Range(0.0, 100.0)] public decimal BPlus { get; set; } = 87m;
    [Range(0.0, 100.0)] public decimal B { get; set; } = 83m;
    [Range(0.0, 100.0)] public decimal BMinus { get; set; } = 80m;
    [Range(0.0, 100.0)] public decimal CPlus { get; set; } = 77m;
    [Range(0.0, 100.0)] public decimal C { get; set; } = 73m;
    [Range(0.0, 100.0)] public decimal CMinus { get; set; } = 70m;
    [Range(0.0, 100.0)] public decimal DPlus { get; set; } = 67m;
    [Range(0.0, 100.0)] public decimal D { get; set; } = 63m;
    [Range(0.0, 100.0)] public decimal DMinus { get; set; } = 60m;

    /// <summary>
    /// Thresholds must descend. A scale where a B outranks an A would make the band lookup in
    /// GRADING_SPEC.md §6 return nonsense, so it is rejected at the edge rather than stored.
    /// </summary>
    public bool IsMonotonic()
    {
        var ordered = new[] { APlus, A, AMinus, BPlus, B, BMinus, CPlus, C, CMinus, DPlus, D, DMinus };
        for (var i = 1; i < ordered.Length; i++)
        {
            if (ordered[i] > ordered[i - 1]) return false;
        }

        return true;
    }
}

public class ParseSyllabusRequest
{
    /// <summary>
    /// Upper bound is a cost control as much as a validation rule: the LLM fallback only ever
    /// sees a trimmed excerpt, but accepting an unbounded body would let a client burn the
    /// deterministic parser's CPU for free.
    /// </summary>
    [Required, StringLength(60000, MinimumLength = 20)]
    public string SyllabusText { get; set; } = string.Empty;
}

public class CreateRuleRequest
{
    [Required]
    public int CategoryId { get; set; }

    /// <summary>"DropLowest" | "CountHighest" | "WeightByScore".</summary>
    [Required]
    public string Type { get; set; } = string.Empty;

    [Range(0, 1000)]
    public int Value { get; set; }

    /// <summary>Required for WeightByScore, best score first. Ignored otherwise.</summary>
    public List<decimal>? WeightDistribution { get; set; }
}

public class CreateSemesterRequest
{
    [Required, StringLength(120, MinimumLength = 1)]
    public string Name { get; set; } = string.Empty;

    [Required, Range(1900, 2200)]
    public int Year { get; set; }

    [Required, StringLength(20)]
    public string Term { get; set; } = string.Empty;

    [Range(0.0, 4.33)]
    public decimal? GpaGoal { get; set; }
}

public class UpdateSemesterRequest
{
    [StringLength(120, MinimumLength = 1)]
    public string? Name { get; set; }

    [Range(1900, 2200)]
    public int? Year { get; set; }

    [StringLength(20)]
    public string? Term { get; set; }

    [Range(0.0, 4.33)]
    public decimal? GpaGoal { get; set; }

    public bool ClearGpaGoal { get; set; }
}

public class ChatRequest
{
    [Required, StringLength(2000, MinimumLength = 1)]
    public string Message { get; set; } = string.Empty;

    public int? SemesterId { get; set; }

    /// <summary>
    /// Prior turns. Capped server-side before being sent upstream — an unbounded history is a
    /// direct multiplier on prompt tokens for every subsequent turn.
    /// </summary>
    public List<DTOs.Responses.ChatMessageDto> History { get; set; } = new();
}
