using GradeCalculator.API.Models;
using GradeCalculator.API.Services.Interfaces;

namespace GradeCalculator.API.Services;

public class GradeRulesService : IGradeRulesService
{
    public IEnumerable<GradeItem> ApplyRules(Category category)
    {
        var items = category.GradeItems.Where(g => g.PointsEarned.HasValue).ToList();
        
        if (!items.Any())
            return items;
        
        foreach (var rule in category.Rules.OrderBy(r => r.Type))
        {
            items = rule.Type switch
            {
                RuleType.DropLowest => ApplyDropLowest(items, rule.Value).ToList(),
                RuleType.CountHighest => ApplyCountHighest(items, rule.Value).ToList(),
                // WeightByScore is handled in the calculator, not here
                _ => items
            };
        }
        
        return items;
    }
    
    public IEnumerable<GradeItem> ApplyDropLowest(IEnumerable<GradeItem> items, int dropCount)
    {
        var itemList = items.ToList();
        
        if (dropCount >= itemList.Count)
            return Enumerable.Empty<GradeItem>();
        
        // Sort by percentage (lowest first) and skip the lowest ones
        return itemList
            .OrderBy(g => g.GetPercentage() ?? 0)
            .Skip(dropCount);
    }
    
    public IEnumerable<GradeItem> ApplyCountHighest(IEnumerable<GradeItem> items, int countNumber)
    {
        var itemList = items.ToList();
        
        if (countNumber >= itemList.Count)
            return itemList;
        
        // Sort by percentage (highest first) and take the top ones
        return itemList
            .OrderByDescending(g => g.GetPercentage() ?? 0)
            .Take(countNumber);
    }
    
    public decimal CalculateWeightedByScore(IEnumerable<GradeItem> items, List<decimal> weightDistribution)
    {
        var sortedItems = items
            .Where(g => g.PointsEarned.HasValue)
            .OrderByDescending(g => g.GetPercentage() ?? 0)
            .ToList();
        
        if (!sortedItems.Any())
            return 0;
        
        decimal totalWeightedScore = 0;
        decimal totalWeight = 0;
        
        for (int i = 0; i < sortedItems.Count && i < weightDistribution.Count; i++)
        {
            var percentage = sortedItems[i].GetPercentage() ?? 0;
            var weight = weightDistribution[i];
            
            totalWeightedScore += percentage * weight;
            totalWeight += weight;
        }
        
        if (totalWeight == 0)
            return 0;
        
        return totalWeightedScore / totalWeight;
    }
}
