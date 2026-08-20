namespace GradeCalculator.API.Grading;

/// <summary>
/// The single server-side implementation of GRADING_SPEC.md.
///
/// Every method is a pure function with no I/O, no clock, and no dependency on EF or ASP.NET.
/// That is a deliberate constraint: it is what lets the whole engine be verified against
/// <c>shared/grade-vectors.json</c>, the same file the browser-side guest-mode engine is
/// verified against, so the two cannot silently disagree.
///
/// If you change behaviour here, update GRADING_SPEC.md and the vector file in the same commit.
/// </summary>
public static class GradeEngine
{
    // -----------------------------------------------------------------------
    // Ordering (GRADING_SPEC.md §2)
    //
    // Written out explicitly rather than as "sort ascending then reverse", because reversing
    // also flips the sortOrder/id tie-breakers and would make drop-lowest and count-highest
    // disagree about which of two equal-percentage items is the same item.
    // -----------------------------------------------------------------------

    private static int CompareWorstFirst(GradeItemInput x, GradeItemInput y)
    {
        var byPercent = x.Percent.CompareTo(y.Percent);
        if (byPercent != 0) return byPercent;
        return CompareTieBreakers(x, y);
    }

    private static int CompareBestFirst(GradeItemInput x, GradeItemInput y)
    {
        var byPercent = y.Percent.CompareTo(x.Percent); // only this component inverts
        if (byPercent != 0) return byPercent;
        return CompareTieBreakers(x, y);
    }

    private static int CompareTieBreakers(GradeItemInput x, GradeItemInput y)
    {
        var byPossible = y.PointsPossible.CompareTo(x.PointsPossible); // DESC in both directions
        if (byPossible != 0) return byPossible;

        var bySortOrder = x.SortOrder.CompareTo(y.SortOrder);
        if (bySortOrder != 0) return bySortOrder;

        return x.Id.CompareTo(y.Id);
    }

    private static List<GradeItemInput> SortedWorstFirst(IEnumerable<GradeItemInput> items)
    {
        var list = items.ToList();
        list.Sort(CompareWorstFirst);
        return list;
    }

    private static List<GradeItemInput> SortedBestFirst(IEnumerable<GradeItemInput> items)
    {
        var list = items.ToList();
        list.Sort(CompareBestFirst);
        return list;
    }

    // -----------------------------------------------------------------------
    // Rules (GRADING_SPEC.md §3)
    // -----------------------------------------------------------------------

    /// <summary>
    /// Applies DropLowest then CountHighest, in that fixed order regardless of rule creation
    /// order, and returns the surviving "counted" items.
    /// </summary>
    public static IReadOnlyList<GradeItemInput> CountedItems(CategoryInput category)
    {
        var items = category.Items.Where(i => i.IsGraded).ToList();
        if (items.Count == 0) return Array.Empty<GradeItemInput>();

        var rules = category.RuleList;

        foreach (var rule in rules.Where(r => r.Kind == RuleKind.DropLowest).OrderBy(r => r.Id))
        {
            var drop = Math.Max(0, rule.Value);
            // Dropping at least as many items as exist empties the category outright; it does
            // not "keep the last one". A student who drops 3 of 2 quizzes has no quiz grade yet.
            items = drop >= items.Count
                ? new List<GradeItemInput>()
                : SortedWorstFirst(items).Skip(drop).ToList();

            if (items.Count == 0) return Array.Empty<GradeItemInput>();
        }

        foreach (var rule in rules.Where(r => r.Kind == RuleKind.CountHighest).OrderBy(r => r.Id))
        {
            var keep = Math.Max(0, rule.Value);
            items = keep >= items.Count ? items : SortedBestFirst(items).Take(keep).ToList();

            if (items.Count == 0) return Array.Empty<GradeItemInput>();
        }

        return items;
    }

    // -----------------------------------------------------------------------
    // Category (GRADING_SPEC.md §4)
    // -----------------------------------------------------------------------

    public static CategoryResult EvaluateCategory(CategoryInput category)
    {
        var warnings = new List<GradingWarning>();
        var counted = CountedItems(category);
        var gradedCount = category.Items.Count(i => i.IsGraded);

        decimal? percent = null;

        if (counted.Count > 0)
        {
            var weightRule = category.RuleList
                .Where(r => r.Kind == RuleKind.WeightByScore)
                .OrderBy(r => r.Id)
                .FirstOrDefault();

            if (weightRule is not null)
            {
                var weights = weightRule.WeightDistribution ?? Array.Empty<decimal>();

                if (weights.Count == counted.Count)
                {
                    var totalWeight = weights.Sum();
                    if (totalWeight != 0m)
                    {
                        var ranked = SortedBestFirst(counted);
                        var weighted = ranked
                            .Select((item, index) => item.Percent * weights[index])
                            .Sum();
                        percent = weighted / totalWeight;
                    }
                    // A zero weight-sum falls through to points-based below rather than
                    // dividing by zero.
                }
                else
                {
                    // Previously the extra items were silently dropped, so adding a 5th exam to
                    // a 4-weight rule made that exam vanish from the grade entirely.
                    warnings.Add(GradingWarning.WeightByScoreLengthMismatch);
                }
            }

            if (percent is null)
            {
                var earned = counted.Sum(i => i.PointsEarned!.Value);
                var possible = counted.Sum(i => i.PointsPossible);
                if (possible > 0) percent = earned / possible * 100m;
            }
        }

        return new CategoryResult(
            Id: category.Id,
            Name: category.Name,
            Weight: category.Weight,
            Percent: percent,
            GradedItemCount: gradedCount,
            TotalItemCount: category.Items.Count,
            CountedItemCount: counted.Count,
            Warnings: warnings);
    }

    // -----------------------------------------------------------------------
    // Class (GRADING_SPEC.md §5, §6, §7)
    // -----------------------------------------------------------------------

    public static ClassResult EvaluateClass(ClassInput classInput)
    {
        var categories = classInput.Categories.Select(EvaluateCategory).ToList();

        decimal weightedSum = 0m;
        decimal participatingWeight = 0m;

        foreach (var category in categories)
        {
            if (category.Percent is null || category.Weight <= 0m) continue;
            weightedSum += category.Weight * category.Percent.Value;
            participatingWeight += category.Weight;
        }

        // The denominator is the participating weight, not 100. A term that is only 60% graded
        // reports the grade over that 60% -- "grade so far" -- rather than pretending the
        // ungraded 40% were zeros.
        decimal? percent = participatingWeight > 0m ? weightedSum / participatingWeight : null;

        string? letter = percent is null ? null : GradeBands.LetterFor(percent.Value, classInput.Scale);
        decimal? gpa = letter is null ? null : GradeBands.GpaPointsFor(letter, classInput.Scale);

        return new ClassResult(
            Id: classInput.Id,
            Name: classInput.Name,
            CreditHours: classInput.CreditHours,
            Percent: percent,
            Letter: letter,
            Gpa: gpa,
            Categories: categories,
            Warnings: categories.SelectMany(c => c.Warnings).Distinct().ToList());
    }

    // -----------------------------------------------------------------------
    // Aggregate GPA (GRADING_SPEC.md §7, §8)
    // -----------------------------------------------------------------------

    /// <summary>
    /// Credit-weighted mean GPA, rounded half-away-from-zero to 2 dp.
    /// Returns null -- never 0.0 -- when nothing qualifies, because a UI that renders 0.00 for
    /// "no grades yet" tells the student they are failing.
    /// </summary>
    public static decimal? AggregateGpa(IEnumerable<(decimal? Gpa, decimal CreditHours)> classes)
    {
        decimal qualityPoints = 0m;
        decimal creditHours = 0m;

        foreach (var (gpa, credits) in classes)
        {
            if (gpa is null || credits <= 0) continue;
            qualityPoints += gpa.Value * credits;
            creditHours += credits;
        }

        if (creditHours <= 0m) return null;

        return Math.Round(qualityPoints / creditHours, 2, MidpointRounding.AwayFromZero);
    }

    /// <summary>Convenience overload for evaluated classes.</summary>
    public static decimal? AggregateGpa(IEnumerable<ClassResult> classes) =>
        AggregateGpa(classes.Select(c => (c.Gpa, c.CreditHours)));
}
