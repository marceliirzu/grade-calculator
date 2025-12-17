namespace GradeCalculator.API.Models;

public class Class
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string Name { get; set; } = string.Empty;
    public int CreditHours { get; set; } = 3;
    public bool ShowOnlyCAndUp { get; set; } = false;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    
    // Navigation
    public User? User { get; set; }
    public GradeScale? GradeScale { get; set; }
    public ICollection<Category> Categories { get; set; } = new List<Category>();
}
