namespace GradeCalculator.API.DTOs.Requests;

public class CreateClassRequest
{
    public string Name { get; set; } = string.Empty;
    public int CreditHours { get; set; } = 3;
    public bool ShowOnlyCAndUp { get; set; } = false;
}

public class CreateCategoryRequest
{
    public int ClassId { get; set; }
    public string Name { get; set; } = string.Empty;
    public decimal Weight { get; set; }
}

public class CreateGradeRequest
{
    public int CategoryId { get; set; }
    public string Name { get; set; } = string.Empty;
    public decimal? PointsEarned { get; set; }
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
    public string SyllabusText { get; set; } = string.Empty;
}

public class CreateRuleRequest
{
    public int CategoryId { get; set; }
    public string Type { get; set; } = string.Empty; // "DropLowest", "CountHighest", "WeightByScore"
    public int Value { get; set; }
    public List<decimal>? WeightDistribution { get; set; } // For WeightByScore
}
