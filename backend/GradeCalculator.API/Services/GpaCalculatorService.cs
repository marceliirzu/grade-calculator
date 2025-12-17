using GradeCalculator.API.Models;
using GradeCalculator.API.Services.Interfaces;

namespace GradeCalculator.API.Services;

public class GpaCalculatorService : IGpaCalculatorService
{
    private readonly IGradeRulesService _rulesService;
    
    public GpaCalculatorService(IGradeRulesService rulesService)
    {
        _rulesService = rulesService;
    }
    
    public decimal? CalculateCategoryGrade(Category category)
    {
        // Apply any rules (drop lowest, count highest, etc.)
        var gradesToCount = _rulesService.ApplyRules(category).ToList();
        
        if (!gradesToCount.Any() || gradesToCount.All(g => g.PointsEarned == null))
            return null;
        
        // Check if there's a WeightByScore rule
        var weightByScoreRule = category.Rules.FirstOrDefault(r => r.Type == RuleType.WeightByScore);
        if (weightByScoreRule != null && !string.IsNullOrEmpty(weightByScoreRule.WeightDistribution))
        {
            var weights = System.Text.Json.JsonSerializer.Deserialize<List<decimal>>(weightByScoreRule.WeightDistribution);
            if (weights != null)
            {
                return _rulesService.CalculateWeightedByScore(gradesToCount, weights);
            }
        }
        
        // Standard calculation: sum of (earned/possible) / count
        var gradesWithScores = gradesToCount.Where(g => g.PointsEarned.HasValue).ToList();
        if (!gradesWithScores.Any())
            return null;
        
        decimal totalEarned = gradesWithScores.Sum(g => g.PointsEarned!.Value);
        decimal totalPossible = gradesWithScores.Sum(g => g.PointsPossible);
        
        if (totalPossible == 0)
            return null;
        
        return (totalEarned / totalPossible) * 100;
    }
    
    public decimal? CalculateClassGrade(Class classEntity)
    {
        var categories = classEntity.Categories.ToList();
        if (!categories.Any())
            return null;
        
        decimal totalWeightedGrade = 0;
        decimal totalWeight = 0;
        
        foreach (var category in categories)
        {
            var categoryGrade = CalculateCategoryGrade(category);
            if (categoryGrade.HasValue && category.Weight > 0)
            {
                totalWeightedGrade += categoryGrade.Value * (category.Weight / 100);
                totalWeight += category.Weight;
            }
        }
        
        if (totalWeight == 0)
            return null;
        
        // Normalize to account for categories that might not have grades yet
        return totalWeightedGrade / (totalWeight / 100);
    }
    
    public decimal? CalculateClassGpa(Class classEntity)
    {
        var classGrade = CalculateClassGrade(classEntity);
        if (!classGrade.HasValue || classEntity.GradeScale == null)
            return null;
        
        var letterGrade = classEntity.GradeScale.GetLetterGrade(classGrade.Value);
        return GradeScale.GetGpaPointsStatic(letterGrade);
    }
    
    public decimal? CalculateOverallGpa(IEnumerable<Class> classes)
    {
        var classList = classes.ToList();
        if (!classList.Any())
            return null;
        
        decimal totalQualityPoints = 0;
        int totalCreditHours = 0;
        
        foreach (var classEntity in classList)
        {
            var classGpa = CalculateClassGpa(classEntity);
            if (classGpa.HasValue)
            {
                totalQualityPoints += classGpa.Value * classEntity.CreditHours;
                totalCreditHours += classEntity.CreditHours;
            }
        }
        
        if (totalCreditHours == 0)
            return null;
        
        return totalQualityPoints / totalCreditHours;
    }
}
