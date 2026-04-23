using System.ComponentModel.DataAnnotations;
using GradeCalculator.API.DTOs.Responses;

namespace GradeCalculator.API.DTOs.Requests;

public class CreateClassRequest
{
    [Required, StringLength(100, MinimumLength = 1)]
    public string Name { get; set; } = string.Empty;
    [Range(0.5, 10.0)]
    public decimal CreditHours { get; set; } = 3;
    public bool ShowOnlyCAndUp { get; set; } = false;
    public int? SemesterId { get; set; }
}

public class CreateCategoryRequest
{
    public int ClassId { get; set; }
    [Required, StringLength(100, MinimumLength = 1)]
    public string Name { get; set; } = string.Empty;
    [Range(0.0, 100.0)]
    public decimal Weight { get; set; }
}

public class CreateGradeRequest
{
    public int CategoryId { get; set; }
    [Required, StringLength(200, MinimumLength = 1)]
    public string Name { get; set; } = string.Empty;
    [Range(0.0, double.MaxValue)]
    public decimal? PointsEarned { get; set; }
    [Range(0.01, double.MaxValue)]
    public decimal PointsPossible { get; set; } = 100;
    public bool IsWhatIf { get; set; } = false;
}

public class UpdateGradeScaleRequest
{
    public decimal APlus { get; set; } = 97;
    public decimal A { get; set; } = 93;
    public decimal AMinus { get; set; } = 90;
    public decimal BPlus { get; set; } = 87;
    public decimal B { get; set; } = 83;
    public decimal BMinus { get; set; } = 80;
    public decimal CPlus { get; set; } = 77;
    public decimal C { get; set; } = 73;
    public decimal CMinus { get; set; } = 70;
    public decimal DPlus { get; set; } = 67;
    public decimal D { get; set; } = 63;
    public decimal DMinus { get; set; } = 60;
}

public class ParseSyllabusRequest
{
    [Required, StringLength(50000, MinimumLength = 1)]
    public string SyllabusText { get; set; } = string.Empty;
}

public class CreateRuleRequest
{
    public int CategoryId { get; set; }
    public string Type { get; set; } = string.Empty; // "DropLowest", "CountHighest", "WeightByScore"
    public int Value { get; set; }
    public List<decimal>? WeightDistribution { get; set; } // For WeightByScore
}

public class CreateSemesterRequest
{
    [Required, StringLength(100, MinimumLength = 1)]
    public string Name { get; set; } = string.Empty;
    [Required, Range(2000, 2100)]
    public int Year { get; set; }
    [Required]
    public string Term { get; set; } = string.Empty; // "Fall", "Spring", "Summer", "Winter"
    [Range(0.0, 4.33)]
    public decimal? GpaGoal { get; set; }
}

public class UpdateSemesterRequest
{
    [Required, StringLength(100, MinimumLength = 1)]
    public string Name { get; set; } = string.Empty;
    [Required, Range(2000, 2100)]
    public int Year { get; set; }
    [Required]
    public string Term { get; set; } = string.Empty;
    [Range(0.0, 4.33)]
    public decimal? GpaGoal { get; set; }
}

public class ChatRequest
{
    [Required, StringLength(2000, MinimumLength = 1)]
    public string Message { get; set; } = string.Empty;
    public int? SemesterId { get; set; }
    public List<ChatMessageDto> History { get; set; } = new();
}
