namespace GradeCalculator.API.DTOs.Responses;

public class ApiResponse<T>
{
    public bool Success { get; set; }
    public string? Message { get; set; }
    public T? Data { get; set; }
    
    public static ApiResponse<T> Ok(T data, string? message = null) => new()
    {
        Success = true,
        Message = message,
        Data = data
    };
    
    public static ApiResponse<T> Fail(string message) => new()
    {
        Success = false,
        Message = message,
        Data = default
    };
}

public class ClassResponse
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public int CreditHours { get; set; }
    public bool ShowOnlyCAndUp { get; set; }
    public decimal? CurrentGrade { get; set; }
    public string? LetterGrade { get; set; }
    public decimal? Gpa { get; set; }
    public List<CategoryResponse> Categories { get; set; } = new();
    public GradeScaleResponse? GradeScale { get; set; }
}

public class CategoryResponse
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public decimal Weight { get; set; }
    public decimal? CurrentGrade { get; set; }
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
    public int TotalCreditHours { get; set; }
    public List<ClassGpaResponse> Classes { get; set; } = new();
}

public class ClassGpaResponse
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public int CreditHours { get; set; }
    public decimal? CurrentGrade { get; set; }
    public string? LetterGrade { get; set; }
    public decimal? Gpa { get; set; }
}

public class SyllabusParseResponse
{
    public string? ClassName { get; set; }
    public int? CreditHours { get; set; }
    public List<ParsedCategory> Categories { get; set; } = new();
    public ParsedGradeScale? GradeScale { get; set; }
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
