namespace GradeCalculator.API.Models;

public class Category
{
    public int Id { get; set; }
    public int ClassId { get; set; }
    public string Name { get; set; } = string.Empty;
    public decimal Weight { get; set; } = 0; // Percentage weight (e.g., 30 for 30%)
    public int SortOrder { get; set; } = 0;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    // Navigation
    public Class? Class { get; set; }
    public ICollection<GradeItem> GradeItems { get; set; } = new List<GradeItem>();
    public ICollection<Rule> Rules { get; set; } = new List<Rule>();
}
