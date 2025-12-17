namespace GradeCalculator.API.Models;

public enum RuleType
{
    DropLowest,      // Drop the lowest X grades
    CountHighest,    // Only count the highest X grades
    WeightByScore    // Weight grades by their score (highest = most weight)
}

public class Rule
{
    public int Id { get; set; }
    public int CategoryId { get; set; }
    public RuleType Type { get; set; }
    public int Value { get; set; } // Number of items to drop/count
    
    // For WeightByScore: JSON string with weight distribution
    // e.g., "[50, 20, 20, 10]" means highest=50%, second=20%, third=20%, fourth=10%
    public string? WeightDistribution { get; set; }
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    // Navigation
    public Category? Category { get; set; }
}
