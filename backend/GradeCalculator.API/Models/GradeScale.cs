namespace GradeCalculator.API.Models;

public class GradeScale
{
    public int Id { get; set; }
    public int ClassId { get; set; }
    
    // A+ can be either 4.0 or 4.33 depending on school
    public decimal APlusGpaValue { get; set; } = 4.0m;
    
    // Grade thresholds (minimum percentage for each grade)
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
    // Below DMinus = F
    
    // Navigation
    public Class? Class { get; set; }
    
    /// <summary>
    /// Converts a percentage to a letter grade
    /// </summary>
    public string GetLetterGrade(decimal percentage)
    {
        if (percentage >= APlus) return "A+";
        if (percentage >= A) return "A";
        if (percentage >= AMinus) return "A-";
        if (percentage >= BPlus) return "B+";
        if (percentage >= B) return "B";
        if (percentage >= BMinus) return "B-";
        if (percentage >= CPlus) return "C+";
        if (percentage >= C) return "C";
        if (percentage >= CMinus) return "C-";
        if (percentage >= DPlus) return "D+";
        if (percentage >= D) return "D";
        if (percentage >= DMinus) return "D-";
        return "F";
    }
    
    /// <summary>
    /// Converts a letter grade to GPA points (with proper 2-decimal values)
    /// </summary>
    public decimal GetGpaPoints(string letterGrade)
    {
        return letterGrade switch
        {
            "A+" => APlusGpaValue,  // 4.0 or 4.33
            "A" => 4.0m,
            "A-" => 3.67m,
            "B+" => 3.33m,
            "B" => 3.0m,
            "B-" => 2.67m,
            "C+" => 2.33m,
            "C" => 2.0m,
            "C-" => 1.67m,
            "D+" => 1.33m,
            "D" => 1.0m,
            "D-" => 0.67m,
            "F" => 0.0m,
            _ => 0.0m
        };
    }
    
    /// <summary>
    /// Static version for when we don't have a GradeScale instance
    /// </summary>
    public static decimal GetGpaPointsStatic(string letterGrade, decimal aPlusValue = 4.0m)
    {
        return letterGrade switch
        {
            "A+" => aPlusValue,
            "A" => 4.0m,
            "A-" => 3.67m,
            "B+" => 3.33m,
            "B" => 3.0m,
            "B-" => 2.67m,
            "C+" => 2.33m,
            "C" => 2.0m,
            "C-" => 1.67m,
            "D+" => 1.33m,
            "D" => 1.0m,
            "D-" => 0.67m,
            "F" => 0.0m,
            _ => 0.0m
        };
    }
}
