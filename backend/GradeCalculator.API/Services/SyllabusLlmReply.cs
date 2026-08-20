using GradeCalculator.API.DTOs.Responses;

namespace GradeCalculator.API.Services;

/// <summary>
/// The raw shape Claude replies with, before any interpretation.
///
/// This is deliberately *not* <see cref="SyllabusParseResponse"/>. The model is asked to report
/// what the syllabus literally says — points where it says points, percentages where it says
/// percentages — and every conversion happens here in C#.
///
/// The alternative, asking the model to "convert points to percentages", puts arithmetic in the
/// one place that cannot be trusted with it. A model that divides 275 by 300 and reports 91.6%
/// is usually right and occasionally, silently, not; and a wrong grade scale is invisible until
/// a student is told they are getting a B when they have an A. The same reasoning is why the
/// grade advisor is handed pre-computed numbers rather than asked to work them out.
/// </summary>
public sealed class SyllabusLlmReply
{
    public string? ClassName { get; set; }

    public decimal? CreditHours { get; set; }

    /// <summary>Total points available in the course, when the syllabus is point-based.</summary>
    public decimal? TotalPoints { get; set; }

    public List<SyllabusLlmCategory> Categories { get; set; } = new();

    /// <summary>Minimum value per letter, in whatever unit <see cref="GradeScaleUnit"/> names.</summary>
    public ParsedGradeScale? GradeScale { get; set; }

    /// <summary>"percent" or "points". Governs how <see cref="GradeScale"/> is interpreted.</summary>
    public string? GradeScaleUnit { get; set; }
}

public sealed class SyllabusLlmCategory
{
    public string Name { get; set; } = string.Empty;

    /// <summary>Set when the syllabus states a percentage.</summary>
    public decimal? Weight { get; set; }

    /// <summary>Set when the syllabus states a point value.</summary>
    public decimal? Points { get; set; }
}

/// <summary>
/// Converts a raw model reply into the percentage-based shape the rest of the app uses.
///
/// The domain is percentage-based end to end — the grading engine, the database and the grade
/// scale all work in percentages — so a point-based syllabus is normalised here, once, at the
/// boundary, rather than leaking a second unit through the system.
/// </summary>
public static class SyllabusLlmConverter
{
    /// <summary>Letters in descending order, paired with their accessors on the scale DTO.</summary>
    private static readonly (string Letter, Func<ParsedGradeScale, decimal?> Get, Action<ParsedGradeScale, decimal?> Set)[] Bands =
    {
        ("A+", s => s.APlus,  (s, v) => s.APlus = v),
        ("A",  s => s.A,      (s, v) => s.A = v),
        ("A-", s => s.AMinus, (s, v) => s.AMinus = v),
        ("B+", s => s.BPlus,  (s, v) => s.BPlus = v),
        ("B",  s => s.B,      (s, v) => s.B = v),
        ("B-", s => s.BMinus, (s, v) => s.BMinus = v),
        ("C+", s => s.CPlus,  (s, v) => s.CPlus = v),
        ("C",  s => s.C,      (s, v) => s.C = v),
        ("C-", s => s.CMinus, (s, v) => s.CMinus = v),
        ("D+", s => s.DPlus,  (s, v) => s.DPlus = v),
        ("D",  s => s.D,      (s, v) => s.D = v),
        ("D-", s => s.DMinus, (s, v) => s.DMinus = v),
    };

    public static SyllabusParseResponse Convert(SyllabusLlmReply reply)
    {
        var notes = new List<string>();

        var totalPoints = ResolveTotalPoints(reply);
        var categories = ConvertCategories(reply, totalPoints, notes);
        var scale = ConvertGradeScale(reply, totalPoints, notes);

        return new SyllabusParseResponse
        {
            ClassName = string.IsNullOrWhiteSpace(reply.ClassName) ? null : reply.ClassName.Trim(),
            CreditHours = reply.CreditHours,
            TotalPoints = totalPoints,
            Categories = categories,
            GradeScale = scale,
            Notes = notes,
        };
    }

    /// <summary>
    /// The denominator for every points-to-percentage conversion.
    ///
    /// An explicitly stated total wins over a derived one: a syllabus that says "1000 points
    /// total" may well list categories summing to 950 because extra credit or a dropped quiz is
    /// unaccounted for, and the stated figure is what the grade scale was written against.
    /// </summary>
    private static decimal? ResolveTotalPoints(SyllabusLlmReply reply)
    {
        if (reply.TotalPoints is > 0) return reply.TotalPoints;

        var summed = reply.Categories
            .Where(category => category.Points is > 0)
            .Sum(category => category.Points!.Value);

        return summed > 0 ? summed : null;
    }

    private static List<ParsedCategory> ConvertCategories(
        SyllabusLlmReply reply,
        decimal? totalPoints,
        List<string> notes)
    {
        var converted = new List<ParsedCategory>();
        var convertedFromPoints = false;

        foreach (var category in reply.Categories)
        {
            if (string.IsNullOrWhiteSpace(category.Name)) continue;

            decimal? weight = category.Weight;

            if (weight is null && category.Points is > 0 && totalPoints is > 0)
            {
                weight = category.Points!.Value / totalPoints.Value * 100m;
                convertedFromPoints = true;
            }

            // A category with neither a weight nor usable points cannot contribute to a grade.
            // Dropping it is better than storing a zero, which would silently shrink every other
            // category's share once the weights are normalised.
            if (weight is null) continue;

            converted.Add(new ParsedCategory { Name = category.Name.Trim(), Weight = weight.Value });
        }

        if (convertedFromPoints && totalPoints is not null)
        {
            notes.Add($"Category weights were converted from points out of {Trim(totalPoints.Value)}.");
        }

        return DeterministicSyllabusParser.NormalizeTo100(converted);
    }

    /// <summary>
    /// Converts the grade scale to percentages, or discards it.
    ///
    /// Discarding is a real outcome, not a failure path: the app falls back to the standard
    /// scale, which is far closer to right than a scale where "A" means 275%.
    /// </summary>
    private static ParsedGradeScale? ConvertGradeScale(
        SyllabusLlmReply reply,
        decimal? totalPoints,
        List<string> notes)
    {
        if (reply.GradeScale is null) return null;

        var isPointBased = string.Equals(reply.GradeScaleUnit, "points", StringComparison.OrdinalIgnoreCase);

        // Trust the numbers over the label. A scale whose values exceed 100 cannot be
        // percentages whatever the model called it, and models mislabel this more often than
        // they misread the digits.
        var looksLikePoints = Bands
            .Select(band => band.Get(reply.GradeScale))
            .Any(value => value is > 100m);

        if (!isPointBased && !looksLikePoints)
        {
            return Validate(reply.GradeScale, notes);
        }

        if (totalPoints is not > 0)
        {
            // Converting needs a denominator, and inventing one would be worse than defaulting.
            notes.Add("The syllabus uses a point-based grade scale but states no point total, " +
                      "so the standard percentage scale was applied. Please check it.");
            return null;
        }

        var converted = new ParsedGradeScale();

        foreach (var (_, get, set) in Bands)
        {
            var value = get(reply.GradeScale);
            if (value is null) continue;

            var percent = value.Value / totalPoints.Value * 100m;

            // Extra credit can push a threshold above the nominal total; a threshold over 100%
            // is unreachable, so it is pinned to 100.
            set(converted, Math.Round(Math.Min(percent, 100m), 2, MidpointRounding.AwayFromZero));
        }

        notes.Add($"Grade scale was converted from points out of {Trim(totalPoints.Value)}.");

        return Validate(converted, notes);
    }

    /// <summary>
    /// A scale must descend and sit within 0-100. Anything else is a misread, and a misread
    /// scale silently reports the wrong letter for every grade in the class.
    /// </summary>
    private static ParsedGradeScale? Validate(ParsedGradeScale scale, List<string> notes)
    {
        var present = Bands
            .Select(band => band.Get(scale))
            .Where(value => value is not null)
            .Select(value => value!.Value)
            .ToList();

        if (present.Count < 3)
        {
            // Two anchors is not a scale; the defaults are a better guess than a fragment.
            return null;
        }

        if (present.Any(value => value is < 0m or > 100m))
        {
            notes.Add("The detected grade scale was out of range and has been ignored.");
            return null;
        }

        for (var i = 1; i < present.Count; i++)
        {
            if (present[i] < present[i - 1]) continue;

            notes.Add("The detected grade scale did not descend consistently and has been ignored.");
            return null;
        }

        return scale;
    }

    /// <summary>Formats a decimal without trailing zeros, so 1000.00 reads as 1000.</summary>
    private static string Trim(decimal value) =>
        value == Math.Floor(value)
            ? ((long)value).ToString()
            : value.ToString("0.##");
}
