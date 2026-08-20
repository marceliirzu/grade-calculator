namespace GradeCalculator.API.Grading;

/// <summary>
/// Letter-band lookup and GPA point values. See GRADING_SPEC.md §6 and §7.
/// </summary>
public static class GradeBands
{
    /// <summary>
    /// Bands in strict descending threshold order. Order is load-bearing: <see cref="LetterFor"/>
    /// returns the first band whose threshold is met, so a reordering silently changes grades.
    /// </summary>
    public static readonly IReadOnlyList<string> Letters = new[]
    {
        "A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "D-", "F",
    };

    /// <summary>
    /// Fixed GPA points per letter. A+ is deliberately absent: it is the only letter whose value
    /// varies per institution (4.0 or 4.33) and must be read from the class's own scale.
    /// </summary>
    private static readonly IReadOnlyDictionary<string, decimal> FixedGpaPoints =
        new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase)
        {
            ["A"] = 4.00m,
            ["A-"] = 3.67m,
            ["B+"] = 3.33m,
            ["B"] = 3.00m,
            ["B-"] = 2.67m,
            ["C+"] = 2.33m,
            ["C"] = 2.00m,
            ["C-"] = 1.67m,
            ["D+"] = 1.33m,
            ["D"] = 1.00m,
            ["D-"] = 0.67m,
            ["F"] = 0.00m,
        };

    /// <summary>Minimum percentage required for a letter under the supplied scale.</summary>
    public static decimal ThresholdFor(GradeScaleInput scale, string letter) => letter.ToUpperInvariant() switch
    {
        "A+" => scale.APlus,
        "A" => scale.A,
        "A-" => scale.AMinus,
        "B+" => scale.BPlus,
        "B" => scale.B,
        "B-" => scale.BMinus,
        "C+" => scale.CPlus,
        "C" => scale.C,
        "C-" => scale.CMinus,
        "D+" => scale.DPlus,
        "D" => scale.D,
        "D-" => scale.DMinus,
        "F" => 0m,
        _ => throw new ArgumentOutOfRangeException(nameof(letter), letter, "Not a valid letter grade."),
    };

    public static bool IsValidLetter(string? letter) =>
        letter is not null && Letters.Contains(letter.ToUpperInvariant());

    /// <summary>
    /// Highest band whose threshold is met. GRADING_SPEC.md §6: the comparison uses the
    /// percentage rounded half-away-from-zero to 4 dp, which absorbs accumulated arithmetic
    /// noise without promoting a genuine 89.96 to an A-.
    /// </summary>
    public static string LetterFor(decimal percent, GradeScaleInput scale)
    {
        var rounded = Math.Round(percent, 4, MidpointRounding.AwayFromZero);

        foreach (var letter in Letters)
        {
            if (letter == "F") break;
            if (rounded >= ThresholdFor(scale, letter)) return letter;
        }

        return "F";
    }

    /// <summary>
    /// GPA points for a letter, honouring the scale's A+ value.
    /// This is the fix for the long-standing bug where class GPA was resolved through a static
    /// helper that defaulted A+ to 4.0, so a school configured for 4.33 silently never got it.
    /// </summary>
    public static decimal GpaPointsFor(string letter, GradeScaleInput scale)
    {
        var key = letter.ToUpperInvariant();
        if (key == "A+") return scale.APlusGpaValue;

        return FixedGpaPoints.TryGetValue(key, out var points)
            ? points
            : throw new ArgumentOutOfRangeException(nameof(letter), letter, "Not a valid letter grade.");
    }
}
