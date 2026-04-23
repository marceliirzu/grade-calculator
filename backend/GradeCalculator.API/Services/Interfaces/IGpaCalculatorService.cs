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

    /// <summary>
    /// Calculates semester GPA weighted by credit hours (same as CalculateOverallGpa but semantically named for semester context)
    /// </summary>
    decimal? CalculateSemesterGpa(IEnumerable<Class> classes);

    /// <summary>
    /// Calculates cumulative GPA across all semesters, weighted by credit hours
    /// </summary>
    decimal? CalculateCumulativeGpa(IEnumerable<IEnumerable<Class>> semesterClasses);

    /// <summary>
    /// Returns progress toward a GPA goal as a 0.0–1.0 ratio (null if no goal)
    /// </summary>
    decimal? CalculateGpaGoalProgress(decimal? currentGpa, decimal? gpaGoal);
}
