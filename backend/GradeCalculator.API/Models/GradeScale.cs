using GradeCalculator.API.Grading;

namespace GradeCalculator.API.Models;

/// <summary>
/// Per-class letter-grade thresholds (the minimum percentage each letter requires).
///
/// This type deliberately carries no calculation logic. Everything that interprets these
/// numbers lives in <see cref="GradeBands"/> so that there is exactly one implementation of
/// GRADING_SPEC.md §6/§7 — the previous version had a <c>GetGpaPoints</c> instance method
/// alongside a <c>GetGpaPointsStatic</c> helper, and the calculator called the static one,
/// which silently ignored <see cref="APlusGpaValue"/>.
/// </summary>
public class GradeScale
{
    public int Id { get; set; }
    public int ClassId { get; set; }

    /// <summary>4.0 at most schools, 4.33 where an A+ is worth more than an A.</summary>
    public decimal APlusGpaValue { get; set; } = 4.0m;

    public decimal APlus { get; set; } = 97m;
    public decimal A { get; set; } = 93m;
    public decimal AMinus { get; set; } = 90m;
    public decimal BPlus { get; set; } = 87m;
    public decimal B { get; set; } = 83m;
    public decimal BMinus { get; set; } = 80m;
    public decimal CPlus { get; set; } = 77m;
    public decimal C { get; set; } = 73m;
    public decimal CMinus { get; set; } = 70m;
    public decimal DPlus { get; set; } = 67m;
    public decimal D { get; set; } = 63m;
    public decimal DMinus { get; set; } = 60m;
    // Anything below DMinus is an F.

    // Navigation
    public Class? Class { get; set; }

    public GradeScaleInput ToInput() => new(
        APlusGpaValue: APlusGpaValue,
        APlus: APlus,
        A: A,
        AMinus: AMinus,
        BPlus: BPlus,
        B: B,
        BMinus: BMinus,
        CPlus: CPlus,
        C: C,
        CMinus: CMinus,
        DPlus: DPlus,
        D: D,
        DMinus: DMinus);

    public static GradeScale Default(int classId = 0) => new() { ClassId = classId };
}
