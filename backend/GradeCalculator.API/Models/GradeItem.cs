using System.ComponentModel.DataAnnotations;

namespace GradeCalculator.API.Models;

public class GradeItem
{
    public int Id { get; set; }
    public int CategoryId { get; set; }

    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    /// <summary>Null means "not graded yet" — the item still counts toward remaining work.</summary>
    public decimal? PointsEarned { get; set; }

    public decimal PointsPossible { get; set; } = 100m;

    /// <summary>Marks a hypothetical score the student is experimenting with.</summary>
    public bool IsWhatIf { get; set; }

    public int SortOrder { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public Category? Category { get; set; }
}
