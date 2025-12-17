namespace GradeCalculator.API.Models;

public class GradeItem
{
    public int Id { get; set; }
    public int CategoryId { get; set; }
    public string Name { get; set; } = string.Empty;
    public decimal? PointsEarned { get; set; }
    public decimal PointsPossible { get; set; } = 100;
    public bool IsWhatIf { get; set; } = false; // True if this is a "what if" scenario grade
    public int SortOrder { get; set; } = 0;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    // Navigation
    public Category? Category { get; set; }
    
    /// <summary>
    /// Gets the percentage score for this grade item
    /// </summary>
    public decimal? GetPercentage()
    {
        if (PointsEarned == null || PointsPossible == 0)
            return null;
        
        return (PointsEarned.Value / PointsPossible) * 100;
    }
}
