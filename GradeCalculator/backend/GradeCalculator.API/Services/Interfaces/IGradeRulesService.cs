using GradeCalculator.API.Models;

namespace GradeCalculator.API.Services.Interfaces;

public interface IGradeRulesService
{
    /// <summary>
    /// Applies all rules to a category and returns the filtered/weighted grade items
    /// </summary>
    IEnumerable<GradeItem> ApplyRules(Category category);
    
    /// <summary>
    /// Applies the "drop lowest" rule
    /// </summary>
    IEnumerable<GradeItem> ApplyDropLowest(IEnumerable<GradeItem> items, int dropCount);
    
    /// <summary>
    /// Applies the "count highest" rule
    /// </summary>
    IEnumerable<GradeItem> ApplyCountHighest(IEnumerable<GradeItem> items, int countNumber);
    
    /// <summary>
    /// Applies weighted scoring based on rank (highest score = highest weight)
    /// </summary>
    decimal CalculateWeightedByScore(IEnumerable<GradeItem> items, List<decimal> weightDistribution);
}
