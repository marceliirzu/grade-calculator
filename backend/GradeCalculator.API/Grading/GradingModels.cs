namespace GradeCalculator.API.Grading;

/// <summary>
/// Non-fatal conditions detected while grading. These are surfaced to the client rather than
/// thrown, because a warning means "your setup is ambiguous", not "we cannot compute a grade".
/// </summary>
public enum GradingWarning
{
    /// <summary>
    /// A WeightByScore rule carries a different number of weights than there are counted items,
    /// so the rule was ignored and points-based aggregation used instead. See GRADING_SPEC.md §4.
    /// </summary>
    WeightByScoreLengthMismatch,
}

public enum RuleKind
{
    DropLowest,
    CountHighest,
    WeightByScore,
}

/// <summary>Outcome of a target-grade query. See GRADING_SPEC.md §9.</summary>
public enum TargetStatus
{
    /// <summary>Nothing is left to grade; the outcome is already fixed.</summary>
    Determined,

    /// <summary>The target holds even if every remaining item scores zero.</summary>
    Secured,

    /// <summary>Reachable by scoring at most 100% on the remaining work.</summary>
    Achievable,

    /// <summary>Would require better than 100% on the remaining work.</summary>
    Unreachable,
}

// ---------------------------------------------------------------------------
// Inputs. These are deliberately decoupled from the EF entities: the engine is a
// pure function of its arguments, which is what makes it testable against the
// shared vectors without a database, a DbContext, or any mocking.
// ---------------------------------------------------------------------------

public sealed record GradeItemInput(
    decimal? PointsEarned,
    decimal PointsPossible,
    int SortOrder = 0,
    int Id = 0)
{
    /// <summary>GRADING_SPEC.md §1: both conditions are required.</summary>
    public bool IsGraded => PointsEarned is not null && PointsPossible > 0;

    /// <summary>
    /// Percentage score. Only meaningful when <see cref="IsGraded"/>; never clamped, because
    /// extra credit legitimately exceeds 100.
    /// </summary>
    public decimal Percent => PointsEarned!.Value / PointsPossible * 100m;
}

public sealed record RuleInput(
    RuleKind Kind,
    int Value = 0,
    IReadOnlyList<decimal>? WeightDistribution = null,
    int Id = 0);

public sealed record CategoryInput(
    string Name,
    decimal Weight,
    IReadOnlyList<GradeItemInput> Items,
    IReadOnlyList<RuleInput>? Rules = null,
    int Id = 0)
{
    public IReadOnlyList<RuleInput> RuleList => Rules ?? Array.Empty<RuleInput>();
}

public sealed record GradeScaleInput(
    decimal APlusGpaValue = 4.0m,
    decimal APlus = 97m,
    decimal A = 93m,
    decimal AMinus = 90m,
    decimal BPlus = 87m,
    decimal B = 83m,
    decimal BMinus = 80m,
    decimal CPlus = 77m,
    decimal C = 73m,
    decimal CMinus = 70m,
    decimal DPlus = 67m,
    decimal D = 63m,
    decimal DMinus = 60m);

public sealed record ClassInput(
    string Name,
    decimal CreditHours,
    GradeScaleInput Scale,
    IReadOnlyList<CategoryInput> Categories,
    int Id = 0);

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

public sealed record CategoryResult(
    int Id,
    string Name,
    decimal Weight,
    decimal? Percent,
    int GradedItemCount,
    int TotalItemCount,
    int CountedItemCount,
    IReadOnlyList<GradingWarning> Warnings)
{
    public bool HasGrade => Percent is not null;
}

public sealed record ClassResult(
    int Id,
    string Name,
    decimal CreditHours,
    decimal? Percent,
    string? Letter,
    decimal? Gpa,
    IReadOnlyList<CategoryResult> Categories,
    IReadOnlyList<GradingWarning> Warnings)
{
    public bool HasGrade => Percent is not null;
}

public sealed record TargetCategoryBreakdown(
    string Name,
    decimal Weight,
    decimal? CurrentPercent,
    int GradedItemCount,
    int TotalItemCount,
    bool IsComplete);

public sealed record TargetResult(
    string TargetLetter,
    decimal TargetPercent,
    TargetStatus Status,
    decimal? NeededOnRemaining,
    decimal? CurrentPercent,
    string? CurrentLetter,
    decimal RemainingPointsPossible,
    IReadOnlyList<TargetCategoryBreakdown> Categories)
{
    public bool IsAchievable => Status is TargetStatus.Secured or TargetStatus.Achievable;
}
