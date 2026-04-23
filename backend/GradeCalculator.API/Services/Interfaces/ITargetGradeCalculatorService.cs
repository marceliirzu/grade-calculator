namespace GradeCalculator.API.Services.Interfaces;

public interface ITargetGradeCalculatorService
{
    /// <summary>
    /// For each category in a class, calculates what percentage the student needs
    /// on remaining ungraded items to hit the overall target letter grade.
    /// Returns a structured breakdown.
    /// </summary>
    Task<TargetGradeResult> CalculateTargetAsync(int classId, string targetLetterGrade, int userId);
}

public class TargetGradeResult
{
    public string ClassName { get; set; } = string.Empty;
    public string TargetGrade { get; set; } = string.Empty;
    public decimal TargetPercentage { get; set; }
    public decimal CurrentGrade { get; set; }
    public bool IsAchievable { get; set; }
    public string Summary { get; set; } = string.Empty;
    public List<CategoryTargetResult> Categories { get; set; } = new();
}

public class CategoryTargetResult
{
    public string CategoryName { get; set; } = string.Empty;
    public decimal Weight { get; set; }
    public decimal? CurrentGrade { get; set; }
    public int GradedItems { get; set; }
    public int TotalItems { get; set; }
    public decimal? NeededScoreOnRemaining { get; set; }
    public bool IsComplete { get; set; }
}
