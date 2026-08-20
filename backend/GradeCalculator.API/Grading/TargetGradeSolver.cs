namespace GradeCalculator.API.Grading;

/// <summary>
/// Solves "what do I need on everything that is left?" — GRADING_SPEC.md §9.
///
/// The previous implementation attempted a closed-form solve whose expression added and
/// subtracted the same weighted term, so it reduced to noise and reported meaningless numbers.
/// This one is defined by construction instead: <see cref="ClassPercentIfRemainingScore"/> is
/// the real grade function with a candidate score substituted into every ungraded item, and the
/// answer is the smallest score at which it reaches the target.
///
/// Bisection rather than algebra, because drop-lowest makes the curve piecewise-linear: once a
/// pending quiz outscores an existing low one, the low one gets dropped instead and the slope
/// changes. The function is still monotonically non-decreasing in the candidate score — scoring
/// better on pending work can never lower a grade — which is exactly the property bisection needs.
/// </summary>
public static class TargetGradeSolver
{
    private const decimal SearchCeiling = 200m;

    /// <summary>Ceiling used only to quantify how far out of reach an unreachable target is.</summary>
    private const decimal UnreachableProbeCeiling = 100_000m;

    private const decimal Tolerance = 0.000000001m; // 1e-9
    private const decimal RoundingNudge = 0.0000001m; // 1e-7, see §9
    private const int MaxIterations = 200;

    public static TargetResult Solve(ClassInput classInput, string targetLetter)
    {
        if (!GradeBands.IsValidLetter(targetLetter))
            throw new ArgumentOutOfRangeException(nameof(targetLetter), targetLetter, "Not a valid letter grade.");

        var normalized = targetLetter.ToUpperInvariant();
        var targetPercent = GradeBands.ThresholdFor(classInput.Scale, normalized);

        var current = GradeEngine.EvaluateClass(classInput);

        var breakdown = classInput.Categories.Select(category =>
        {
            var evaluated = GradeEngine.EvaluateCategory(category);
            return new TargetCategoryBreakdown(
                Name: category.Name,
                Weight: category.Weight,
                CurrentPercent: evaluated.Percent,
                GradedItemCount: evaluated.GradedItemCount,
                TotalItemCount: evaluated.TotalItemCount,
                IsComplete: evaluated.TotalItemCount > 0 && evaluated.GradedItemCount == evaluated.TotalItemCount);
        }).ToList();

        var remainingPossible = classInput.Categories
            .SelectMany(c => c.Items)
            .Where(i => !i.IsGraded)
            .Sum(i => i.PointsPossible);

        TargetResult Build(TargetStatus status, decimal? needed) => new(
            TargetLetter: normalized,
            TargetPercent: targetPercent,
            Status: status,
            NeededOnRemaining: needed,
            CurrentPercent: current.Percent,
            CurrentLetter: current.Letter,
            RemainingPointsPossible: remainingPossible,
            Categories: breakdown);

        var hasUngraded = classInput.Categories.Any(c => c.Items.Any(i => !i.IsGraded));
        if (!hasUngraded) return Build(TargetStatus.Determined, null);

        // Already safe even in the worst case.
        if (ClassPercentIfRemainingScore(classInput, 0m) is { } atZero && atZero >= targetPercent)
            return Build(TargetStatus.Secured, null);

        // Judged at 100, not at the top of the search range. Extra credit above 100% is legal on
        // an item (§1), but a target that *requires* it is out of reach for planning purposes.
        var atHundred = ClassPercentIfRemainingScore(classInput, 100m);
        var unreachable = atHundred is null || atHundred < targetPercent;

        var ceiling = unreachable ? UnreachableProbeCeiling : SearchCeiling;

        // Guard against ungraded work that cannot move the grade at all — for example items
        // sitting in a zero-weight category. No score would ever reach the target, so there is
        // no meaningful number to report.
        var atCeiling = ClassPercentIfRemainingScore(classInput, ceiling);
        if (atCeiling is null || atCeiling < targetPercent)
            return Build(TargetStatus.Unreachable, null);

        var low = 0m;
        var high = ceiling;

        for (var i = 0; i < MaxIterations && high - low > Tolerance; i++)
        {
            var mid = (low + high) / 2m;
            var value = ClassPercentIfRemainingScore(classInput, mid);

            if (value is not null && value >= targetPercent) high = mid;
            else low = mid;
        }

        // Round up: reporting a score that would just miss the target is the one error that
        // actually costs the student something. The nudge keeps a converged 86.0000000001 from
        // being published as 86.01.
        var needed = Math.Ceiling((high - RoundingNudge) * 100m) / 100m;
        if (needed < 0m) needed = 0m;

        return Build(unreachable ? TargetStatus.Unreachable : TargetStatus.Achievable, needed);
    }

    /// <summary>
    /// The class percentage that would result if every currently-ungraded item scored
    /// <paramref name="score"/> percent of its own points possible. Runs the full engine, so
    /// drop-lowest, count-highest and weight-by-score all apply to the projection exactly as
    /// they apply to the real grade.
    /// </summary>
    public static decimal? ClassPercentIfRemainingScore(ClassInput classInput, decimal score)
    {
        var projected = classInput with
        {
            Categories = classInput.Categories.Select(category => category with
            {
                Items = category.Items
                    .Select(item => item.IsGraded
                        ? item
                        : item with { PointsEarned = score / 100m * item.PointsPossible })
                    .ToList(),
            }).ToList(),
        };

        return GradeEngine.EvaluateClass(projected).Percent;
    }
}
