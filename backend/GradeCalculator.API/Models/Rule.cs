using System.ComponentModel.DataAnnotations;
using GradeCalculator.API.Grading;

namespace GradeCalculator.API.Models;

/// <summary>
/// A grading rule attached to a category.
///
/// The stored column is <see cref="RuleKind"/> from the grading engine rather than a parallel
/// persistence enum. One enum means the database, the API contract and the engine cannot drift
/// into disagreeing about what "1" means. The integer values are load-bearing — reordering
/// <see cref="RuleKind"/> would silently reinterpret every existing row.
/// </summary>
public class Rule
{
    public int Id { get; set; }
    public int CategoryId { get; set; }

    public RuleKind Type { get; set; }

    /// <summary>Number of items to drop or keep. Unused by <see cref="RuleKind.WeightByScore"/>.</summary>
    public int Value { get; set; }

    /// <summary>
    /// JSON array of weights for <see cref="RuleKind.WeightByScore"/>, best score first —
    /// e.g. <c>[50,20,20,10]</c>. Null for every other rule kind.
    /// </summary>
    [MaxLength(1000)]
    public string? WeightDistribution { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public Category? Category { get; set; }
}
