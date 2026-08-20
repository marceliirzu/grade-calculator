using System.Text;
using System.Text.RegularExpressions;
using GradeCalculator.API.DTOs.Responses;

namespace GradeCalculator.API.Services;

/// <summary>
/// Zero-token syllabus parser. Extracts grading categories, grade scale,
/// class name and credit hours with deterministic rules. When it is confident
/// (weights reconcile to 100%), the LLM is never called. When it isn't, it
/// still contributes whatever it found plus a trimmed, grading-relevant
/// excerpt of the syllabus so the LLM call stays small.
/// </summary>
public static class DeterministicSyllabusParser
{
    public sealed class Result
    {
        public string? ClassName { get; set; }
        public decimal? CreditHours { get; set; }
        public List<ParsedCategory> Categories { get; set; } = new();

        /// <summary>Course point total when the syllabus is point-based; null otherwise.</summary>
        public decimal? TotalPoints { get; set; }
        public ParsedGradeScale? GradeScale { get; set; }

        /// <summary>True when categories were found and reconcile to exactly 100%.</summary>
        public bool CategoriesConfident { get; set; }
    }

    // Names that look like category lines but are not categories.
    private static readonly string[] ExcludedNames =
    {
        "total", "grand total", "grading scale", "grade scale", "letter grade",
        "final grade", "course grade", "overall", "weight", "category", "percentage",
        "points possible", "scale", "gpa", "extra credit"
    };

    private static readonly Regex PercentLine = new(
        @"^(?<name>[A-Za-z][A-Za-z0-9&/()'’ \-]{1,60}?)\s*(?:\((?:\d+|[A-Za-z ,]+)\))?\s*(?:[:=\-–—]|\.{2,})*\s*(?<pct>\d{1,3}(?:\.\d+)?)\s*%(?!\s*[-–—]\s*\d)",
        RegexOptions.Compiled);

    private static readonly Regex PercentFirstLine = new(
        @"^(?<pct>\d{1,3}(?:\.\d+)?)\s*%\s*(?:[:\-–—])?\s*(?<name>[A-Za-z][A-Za-z0-9&/()'’ \-]{1,60})$",
        RegexOptions.Compiled);

    private static readonly Regex PointsLine = new(
        @"^(?<name>[A-Za-z][A-Za-z0-9&/()'’ \-]{1,60}?)\s*(?:\([^)]*\))?\s*(?:[:=\-–—]|\.{2,})*\s*(?<pts>\d{1,5}(?:\.\d+)?)\s*(?:points|pts?)\b",
        RegexOptions.Compiled | RegexOptions.IgnoreCase);

    private static readonly Regex GradeLetterOnly = new(@"^[A-F][+\-−]?$", RegexOptions.Compiled);

    // "A 90", "B+ 87-89", "C 70-79" — grade-scale rows, not categories.
    private static readonly Regex GradeLetterPrefix = new(@"^[A-F][+\-−]?(?![A-Za-z])", RegexOptions.Compiled);
    private static readonly Regex NumericRange = new(@"\d\s*[-–—]\s*\d", RegexOptions.Compiled);

    private static readonly Regex CourseCode = new(
        @"\b[A-Z]{2,5}\s?-?\s?\d{3,4}[A-Z]?\b", RegexOptions.Compiled);

    private static readonly Regex CreditHoursRx = new(
        @"(?<n>\d{1,2}(?:\.\d)?)\s*(?:credit|semester)\s*(?:hours?|hrs?|units?)?|credit\s*hours?\s*[:=]?\s*(?<n2>\d{1,2}(?:\.\d)?)|credits?\s*[:=]\s*(?<n3>\d{1,2}(?:\.\d)?)",
        RegexOptions.Compiled | RegexOptions.IgnoreCase);

    // "A: 93", "A 93-100", "A- = 90%", "93-100 A"
    private static readonly Regex ScaleEntry = new(
        @"(?<letter>[A-D][+\-−]?)\s*[:=]?\s*(?<lo>\d{2,3}(?:\.\d+)?)\s*(?:[-–—]\s*\d{2,3}(?:\.\d+)?)?\s*%?|(?<lo2>\d{2,3}(?:\.\d+)?)\s*(?:[-–—]\s*\d{2,3}(?:\.\d+)?)?\s*%?\s*[:=]?\s*(?<letter2>[A-D][+\-−]?)\b",
        RegexOptions.Compiled);

    private static readonly string[] GradingKeywords =
    {
        "grade", "grading", "weight", "percent", "%", "points", "pts", "exam", "quiz",
        "homework", "assignment", "project", "lab", "participation", "attendance",
        "midterm", "final", "paper", "essay", "presentation", "discussion", "credit",
        "scale", "breakdown", "evaluation", "assessment"
    };

    public static Result Parse(string text)
    {
        var result = new Result();
        var lines = Normalize(text);

        result.ClassName = FindClassName(lines);
        result.CreditHours = FindCreditHours(lines);

        var (percentCats, pointCats) = FindCategories(lines);

        // Categories are read before the scale, because a point-based scale ("A = 275") can
        // only be turned into a percentage once the course total is known — and the summed
        // category points are where that total comes from.
        var totalPoints = pointCats.Count > 0 ? pointCats.Sum(c => c.Points) : (decimal?)null;
        result.TotalPoints = totalPoints;
        result.GradeScale = FindGradeScale(lines, totalPoints);

        // Prefer percentage categories when they reconcile; otherwise convert points.
        var chosen = ChooseCategories(percentCats, pointCats);
        if (chosen != null)
        {
            result.Categories = chosen;
            result.CategoriesConfident = true;
        }
        else
        {
            // keep the best partial guess for merging with the LLM result
            result.Categories = percentCats.Count >= pointCats.Count ? percentCats : ConvertPoints(pointCats);
        }

        return result;
    }

    /// <summary>
    /// Reduces a full syllabus to the lines most likely to describe grading, so the LLM
    /// fallback reads a fraction of the tokens.
    ///
    /// Lines are selected by <em>relevance</em>, then emitted in document order. The previous
    /// version selected in document order and stopped at the character budget, which meant a
    /// syllabus with a long attendance or academic-integrity section before its grading table
    /// spent the entire budget on policy prose and cut the grading table off completely — the
    /// model then correctly reported "no categories", and the parse died at the last tier.
    /// Real syllabi bury the grading table on page three, so this was the common case, not the
    /// edge case.
    /// </summary>
    public static string TrimForLlm(string text, int maxChars = 6000)
    {
        var lines = Normalize(text);
        if (lines.Count == 0) return string.Empty;

        var scores = new int[lines.Count];

        for (var i = 0; i < lines.Count; i++)
        {
            scores[i] = ScoreLine(lines[i], i);
        }

        // Give the neighbours of a strong line a share of its score. Grading tables are often
        // split across rows, and a header ("Grading:") is worthless without the rows beneath it.
        var boosted = (int[])scores.Clone();
        for (var i = 0; i < lines.Count; i++)
        {
            if (scores[i] < StrongSignal) continue;

            if (i > 0) boosted[i - 1] = Math.Max(boosted[i - 1], ContextScore);
            if (i + 1 < lines.Count) boosted[i + 1] = Math.Max(boosted[i + 1], ContextScore);
            if (i + 2 < lines.Count) boosted[i + 2] = Math.Max(boosted[i + 2], ContextScore);
        }

        // Highest-scoring lines claim the budget first...
        var keep = new bool[lines.Count];
        var used = 0;

        foreach (var index in Enumerable.Range(0, lines.Count)
                     .Where(i => boosted[i] > 0)
                     .OrderByDescending(i => boosted[i])
                     .ThenBy(i => i))
        {
            var cost = lines[index].Length + 1;
            if (used + cost > maxChars) continue; // skip, don't stop: a later line may still fit

            keep[index] = true;
            used += cost;
        }

        // ...but the excerpt is assembled in document order, so the model sees a coherent
        // document rather than a relevance-ranked jumble.
        //
        // A newline is appended explicitly rather than via AppendLine, which emits a
        // carriage-return pair on Windows: that is two characters against a budget costed at
        // one, so the excerpt would overrun the cap by a byte per line.
        var builder = new StringBuilder(used);
        for (var i = 0; i < lines.Count; i++)
        {
            if (keep[i]) builder.Append(lines[i]).Append(LineSeparator);
        }

        var trimmed = builder.ToString();

        return trimmed.Length > 0
            ? trimmed
            : text[..Math.Min(text.Length, maxChars)];
    }

    /// <summary>Line separator for the excerpt. Always one character, so the budget is exact.</summary>
    private const char LineSeparator = (char)10;

    /// <summary>Score at or above which a line pulls its neighbours in as context.</summary>
    private const int StrongSignal = 6;

    /// <summary>Score given to a line adjacent to a strong signal.</summary>
    private const int ContextScore = 3;

    /// <summary>
    /// How likely a line is to carry grading information. A weight row beats a section header,
    /// which beats a passing mention of the word "exam" in a policy paragraph.
    /// </summary>
    private static int ScoreLine(string line, int index)
    {
        var lower = line.ToLowerInvariant();

        // An actual weight row — the thing we are ultimately looking for.
        if (PercentLine.IsMatch(line) || PercentFirstLine.IsMatch(line) || PointsLine.IsMatch(line))
            return 10;

        // Any percentage at all, e.g. a grade-scale row.
        if (AnyPercent.IsMatch(line)) return 8;

        // A heading that introduces the breakdown.
        if (GradingHeading.IsMatch(lower)) return 7;

        // A points figure that did not match the stricter row pattern.
        if (AnyPoints.IsMatch(lower)) return 5;

        // The course title and credit hours usually sit at the very top and are cheap to keep.
        if (index < 8) return 4;

        // A bare topical keyword. Deliberately the weakest signal: "attendance is required" is
        // prose, not a grading table, and it used to outrank the table purely by appearing first.
        if (GradingKeywords.Any(keyword => lower.Contains(keyword))) return 1;

        return 0;
    }

    private static readonly Regex AnyPercent = new(@"\d\s*%", RegexOptions.Compiled);

    private static readonly Regex AnyPoints = new(
        @"\d+\s*(?:points|pts?)\b", RegexOptions.Compiled | RegexOptions.IgnoreCase);

    private static readonly Regex GradingHeading = new(
        @"^\s*(?:course\s+)?(?:grade|grading|evaluation|assessment|weight)",
        RegexOptions.Compiled | RegexOptions.IgnoreCase);


    // ---------------- internals ----------------

    private static List<string> Normalize(string text)
    {
        return text
            .Replace("\r\n", "\n")
            .Replace('\t', ' ')
            .Replace('|', ' ')
            .Replace('•', ' ')
            .Replace('●', ' ')
            .Replace('▪', ' ')
            .Split('\n')
            .Select(l => Regex.Replace(l, @"\s{2,}", "  ").Trim(' ', '-', '*', '‣'))
            .Where(l => l.Length > 0)
            .ToList();
    }

    private static (List<ParsedCategory> percent, List<(string Name, decimal Points)> points) FindCategories(List<string> lines)
    {
        var percent = new List<ParsedCategory>();
        var points = new List<(string, decimal)>();

        foreach (var line in lines)
        {
            if (line.Length > 120) continue; // prose, not a table row

            var m = PercentLine.Match(line);
            if (!m.Success) m = PercentFirstLine.Match(line);

            if (m.Success && IsPlausibleName(m.Groups["name"].Value) &&
                decimal.TryParse(m.Groups["pct"].Value, out var pct) && pct is > 0 and <= 100)
            {
                AddUnique(percent, CleanName(m.Groups["name"].Value), pct);
                continue;
            }

            var pm = PointsLine.Match(line);
            if (pm.Success && IsPlausibleName(pm.Groups["name"].Value) &&
                decimal.TryParse(pm.Groups["pts"].Value, out var pts) && pts > 0)
            {
                var name = CleanName(pm.Groups["name"].Value);
                if (!points.Any(p => p.Item1.Equals(name, StringComparison.OrdinalIgnoreCase)))
                    points.Add((name, pts));
            }
        }

        return (percent, points);
    }

    private static void AddUnique(List<ParsedCategory> list, string name, decimal weight)
    {
        if (list.Any(c => c.Name.Equals(name, StringComparison.OrdinalIgnoreCase))) return;
        list.Add(new ParsedCategory { Name = name, Weight = weight });
    }

    private static bool IsPlausibleName(string raw)
    {
        var name = raw.Trim();
        if (name.Length < 3) return false;
        if (GradeLetterOnly.IsMatch(name)) return false;
        if (GradeLetterPrefix.IsMatch(name)) return false;
        if (NumericRange.IsMatch(name)) return false; // "90-100" style — grade scale row
        if (name.Count(char.IsDigit) > 2) return false;

        var lower = name.ToLowerInvariant();
        return !ExcludedNames.Any(x => lower == x || lower.StartsWith(x + " ") || lower.EndsWith(" " + x));
    }

    private static string CleanName(string raw)
    {
        var name = Regex.Replace(raw.Trim(' ', ':', '-', '–', '.', '='), @"\s{2,}", " ");
        return name.Length <= 1 ? name : char.ToUpper(name[0]) + name[1..];
    }

    private static List<ParsedCategory>? ChooseCategories(
        List<ParsedCategory> percent, List<(string Name, decimal Points)> points)
    {
        if (percent.Count >= 2)
        {
            var sum = percent.Sum(c => c.Weight);
            if (sum is >= 98 and <= 102)
                return NormalizeTo100(percent);
        }

        if (points.Count >= 2)
        {
            var converted = ConvertPoints(points);
            if (converted.Count >= 2)
                return NormalizeTo100(converted);
        }

        return null;
    }

    private static List<ParsedCategory> ConvertPoints(List<(string Name, decimal Points)> points)
    {
        var total = points.Sum(p => p.Points);
        if (total <= 0) return new List<ParsedCategory>();
        return points
            .Select(p => new ParsedCategory { Name = p.Name, Weight = Math.Round(p.Points / total * 100, 2) })
            .ToList();
    }

    /// <summary>Exact-math normalization: rounds to 2 decimals, puts the remainder on the largest category.</summary>
    public static List<ParsedCategory> NormalizeTo100(List<ParsedCategory> categories)
    {
        var sum = categories.Sum(c => c.Weight);
        if (sum <= 0) return categories;

        foreach (var c in categories)
            c.Weight = Math.Round(c.Weight / sum * 100, 2);

        var diff = 100m - categories.Sum(c => c.Weight);
        if (diff != 0)
        {
            var largest = categories.OrderByDescending(c => c.Weight).First();
            largest.Weight = Math.Round(largest.Weight + diff, 2);
        }

        return categories;
    }

    private static string? FindClassName(List<string> lines)
    {
        // Explicit label wins
        foreach (var line in lines.Take(30))
        {
            var m = Regex.Match(line, @"^(?:course(?:\s*(?:title|name))?|class)\s*[:=]\s*(?<t>.{3,90})$",
                RegexOptions.IgnoreCase);
            if (m.Success) return m.Groups["t"].Value.Trim();
        }

        // Otherwise the first header-ish line containing a course code
        foreach (var line in lines.Take(15))
        {
            if (line.Length <= 90 && CourseCode.IsMatch(line) &&
                !line.Contains('@') && !line.ToLowerInvariant().Contains("office"))
                return line.Trim();
        }

        return null;
    }

    private static decimal? FindCreditHours(List<string> lines)
    {
        foreach (var line in lines.Take(40))
        {
            var lower = line.ToLowerInvariant();
            if (!lower.Contains("credit") && !lower.Contains("unit")) continue;

            var m = CreditHoursRx.Match(line);
            if (!m.Success) continue;

            var raw = m.Groups["n"].Success ? m.Groups["n"].Value
                    : m.Groups["n2"].Success ? m.Groups["n2"].Value
                    : m.Groups["n3"].Value;

            if (decimal.TryParse(raw, out var n) && n is >= 1 and <= 12)
                return n; // 1.5-credit labs are real; rounding here would skew the GPA
        }

        return null;
    }

    private static ParsedGradeScale? FindGradeScale(List<string> lines, decimal? totalPoints)
    {
        var thresholds = new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase);

        // Only look at lines near grading-scale context to avoid picking up
        // stray "A 90" fragments from prose.
        for (var i = 0; i < lines.Count; i++)
        {
            var lower = lines[i].ToLowerInvariant();
            var inContext = lower.Contains("scale") || lower.Contains("letter") ||
                            Regex.IsMatch(lines[i], @"[A-D][+\-−]?\s*[:=]?\s*\d{2,3}");
            if (!inContext) continue;

            foreach (Match m in ScaleEntry.Matches(lines[i]))
            {
                var letter = m.Groups["letter"].Success ? m.Groups["letter"].Value : m.Groups["letter2"].Value;
                var loRaw = m.Groups["lo"].Success ? m.Groups["lo"].Value : m.Groups["lo2"].Value;
                if (string.IsNullOrEmpty(letter) || string.IsNullOrEmpty(loRaw)) continue;

                letter = letter.Replace('−', '-');
                if (!decimal.TryParse(loRaw, out var lo)) continue;

                // A threshold above 100 is a point total, not a percentage. Previously these
                // were discarded outright, so a course graded out of 300 points silently lost
                // its scale and fell back to the standard 93/90/87 — which is simply a
                // different course's grading policy.
                if (lo > 100m)
                {
                    if (totalPoints is not > 0) continue;

                    lo = Math.Round(Math.Min(lo / totalPoints.Value * 100m, 100m), 2, MidpointRounding.AwayFromZero);
                }

                // Below 40 is noise: page numbers, dates, room numbers. Even a generous scale
                // does not put a D- under 40.
                if (lo is < 40m or > 100m) continue;

                if (!thresholds.ContainsKey(letter))
                    thresholds[letter] = lo;
            }
        }

        if (thresholds.Count < 4) return null; // not enough signal — let defaults apply

        decimal? Get(string l) => thresholds.TryGetValue(l, out var v) ? v : null;

        var scale = new ParsedGradeScale
        {
            APlus = Get("A+"), A = Get("A"), AMinus = Get("A-"),
            BPlus = Get("B+"), B = Get("B"), BMinus = Get("B-"),
            CPlus = Get("C+"), C = Get("C"), CMinus = Get("C-"),
            DPlus = Get("D+"), D = Get("D"), DMinus = Get("D-")
        };

        // Sanity: thresholds must be descending where present.
        var ordered = new[]
        {
            scale.APlus, scale.A, scale.AMinus, scale.BPlus, scale.B, scale.BMinus,
            scale.CPlus, scale.C, scale.CMinus, scale.DPlus, scale.D, scale.DMinus
        }.Where(v => v.HasValue).Select(v => v!.Value).ToList();

        for (var i = 1; i < ordered.Count; i++)
            if (ordered[i] >= ordered[i - 1]) return null;

        return scale;
    }
}
