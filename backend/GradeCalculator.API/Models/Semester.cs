using System.ComponentModel.DataAnnotations;

namespace GradeCalculator.API.Models;

public class Semester
{
    public int Id { get; set; }
    public int UserId { get; set; }

    /// <summary>Display name, e.g. "Fall 2025".</summary>
    [MaxLength(120)]
    public string Name { get; set; } = string.Empty;

    public int Year { get; set; }

    /// <summary>"Fall" | "Spring" | "Summer" | "Winter".</summary>
    [MaxLength(20)]
    public string Term { get; set; } = string.Empty;

    /// <summary>Optional target GPA the student is aiming at this term.</summary>
    public decimal? GpaGoal { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public User? User { get; set; }
    public ICollection<Class> Classes { get; set; } = new List<Class>();
}
