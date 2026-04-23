namespace GradeCalculator.API.Models;

public class Semester
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty; // e.g., "Fall 2025"
    public int Year { get; set; }
    public string Term { get; set; } = string.Empty; // "Fall", "Spring", "Summer", "Winter"
    public decimal? GpaGoal { get; set; }
    public int UserId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public User User { get; set; } = null!;
    public ICollection<Class> Classes { get; set; } = new List<Class>();
}
