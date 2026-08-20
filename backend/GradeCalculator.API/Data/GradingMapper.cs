using System.Text.Json;
using GradeCalculator.API.Grading;
using GradeCalculator.API.Models;

namespace GradeCalculator.API.Data;

/// <summary>
/// Translates EF entities into the pure inputs the grading engine consumes.
///
/// This is the only seam between persistence and grading. Keeping it in one place is what lets
/// <see cref="GradeEngine"/> stay free of EF, nullable navigation properties and lazy-loading
/// surprises — a category whose <c>GradeItems</c> collection was never <c>Include</c>d would
/// otherwise silently grade as "no items yet" instead of throwing.
/// </summary>
public static class GradingMapper
{
    public static GradeItemInput ToInput(this GradeItem item) => new(
        PointsEarned: item.PointsEarned,
        PointsPossible: item.PointsPossible,
        SortOrder: item.SortOrder,
        Id: item.Id);

    public static RuleInput ToInput(this Rule rule) => new(
        Kind: rule.Type,
        Value: rule.Value,
        WeightDistribution: ParseWeights(rule.WeightDistribution),
        Id: rule.Id);

    public static CategoryInput ToInput(this Category category) => new(
        Name: category.Name,
        Weight: category.Weight,
        Items: category.GradeItems.Select(ToInput).ToList(),
        Rules: category.Rules.Select(ToInput).ToList(),
        Id: category.Id);

    public static ClassInput ToInput(this Class entity) => new(
        Name: entity.Name,
        CreditHours: entity.CreditHours,
        // A class with no scale row falls back to the standard scale rather than losing its
        // grade. The row is created alongside the class, so this only fires for legacy data.
        Scale: (entity.GradeScale ?? GradeScale.Default(entity.Id)).ToInput(),
        Categories: entity.Categories.OrderBy(c => c.SortOrder).ThenBy(c => c.Id).Select(ToInput).ToList(),
        Id: entity.Id);

    /// <summary>
    /// Weight lists are stored as JSON. Malformed JSON yields null rather than throwing: a
    /// corrupt rule should degrade that category to points-based aggregation (and raise a
    /// warning downstream), not break the whole gradebook.
    /// </summary>
    private static IReadOnlyList<decimal>? ParseWeights(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;

        try
        {
            return JsonSerializer.Deserialize<List<decimal>>(json);
        }
        catch (JsonException)
        {
            return null;
        }
    }
}
