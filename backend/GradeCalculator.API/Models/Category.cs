using System.ComponentModel.DataAnnotations;

namespace GradeCalculator.API.Models;

public class Category
{
    public int Id { get; set; }
    public int ClassId { get; set; }

    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    /// <summary>Percentage weight within the class, e.g. 30 for 30%.</summary>
    public decimal Weight { get; set; }

    public int SortOrder { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public Class? Class { get; set; }
    public ICollection<GradeItem> GradeItems { get; set; } = new List<GradeItem>();
    public ICollection<Rule> Rules { get; set; } = new List<Rule>();
}
