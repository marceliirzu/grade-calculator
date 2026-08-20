using System.ComponentModel.DataAnnotations;

namespace GradeCalculator.API.Models;

public class Class
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public int? SemesterId { get; set; }

    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    public decimal CreditHours { get; set; } = 3m;

    /// <summary>UI preference: hide D/F rows in the "what do I need" table.</summary>
    public bool ShowOnlyCAndUp { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public User? User { get; set; }
    public Semester? Semester { get; set; }
    public GradeScale? GradeScale { get; set; }
    public ICollection<Category> Categories { get; set; } = new List<Category>();
}
