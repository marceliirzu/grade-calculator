using GradeCalculator.API.Models;

namespace GradeCalculator.API.Services.Interfaces;

public interface IGpaCalculatorService
{
    /// <summary>
    /// Calculates the percentage grade for a single category
    /// </summary>
    decimal? CalculateCategoryGrade(Category category);
    
    /// <summary>
    /// Calculates the overall percentage grade for a class
    /// </summary>
    decimal? CalculateClassGrade(Class classEntity);
    
    /// <summary>
    /// Calculates the GPA for a single class
    /// </summary>
    decimal? CalculateClassGpa(Class classEntity);
    
    /// <summary>
    /// Calculates the overall GPA across all classes (weighted by credit hours)
    /// </summary>
    decimal? CalculateOverallGpa(IEnumerable<Class> classes);
}
