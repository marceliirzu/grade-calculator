using GradeCalculator.API.Grading;
using Xunit;

namespace GradeCalculator.Tests.Grading;

/// <summary>
/// Runs the C# engine against shared/grade-vectors.json — the same file the browser-side
/// guest-mode engine is tested against. If these pass and the Vitest suite passes, the two
/// implementations agree on every documented behaviour.
/// </summary>
public class GradeEngineVectorTests
{
    /// <summary>
    /// Percentages compare with tolerance because the browser engine uses IEEE-754 doubles
    /// while this one uses decimal. GPAs compare exactly — they are table values.
    /// </summary>
    private const decimal PercentTolerance = 0.000001m;

    private static void AssertClose(decimal? expected, decimal? actual, string because)
    {
        if (expected is null || actual is null)
        {
            Assert.True(expected is null && actual is null,
                $"{because}: expected {Show(expected)}, got {Show(actual)}");
            return;
        }

        Assert.True(Math.Abs(expected.Value - actual.Value) <= PercentTolerance,
            $"{because}: expected {expected.Value}, got {actual.Value} (tolerance {PercentTolerance})");
    }

    private static string Show(decimal? value) => value?.ToString() ?? "null";

    [Theory]
    [MemberData(nameof(GradeVectors.ClassCaseIds), MemberType = typeof(GradeVectors))]
    public void ClassVector(string caseId)
    {
        var vector = GradeVectors.Class(caseId);
        var input = GradeVectors.ToClass(caseId, vector.CreditHours, vector.Scale, vector.Categories);

        var result = GradeEngine.EvaluateClass(input);

        AssertClose(vector.Expect.ClassPercent, result.Percent, $"{caseId}: classPercent");
        Assert.Equal(vector.Expect.Letter, result.Letter);

        if (vector.Expect.ClassGpa is null) Assert.Null(result.Gpa);
        else Assert.Equal(vector.Expect.ClassGpa, result.Gpa);

        foreach (var (name, expected) in vector.Expect.CategoryPercents ?? new())
        {
            var category = Assert.Single(result.Categories, c => c.Name == name);
            AssertClose(expected, category.Percent, $"{caseId}: category '{name}'");
        }

        var expectedWarnings = (vector.Expect.Warnings ?? new List<string>())
            .Select(Enum.Parse<GradingWarning>)
            .OrderBy(w => w)
            .ToList();

        Assert.Equal(expectedWarnings, result.Warnings.OrderBy(w => w).ToList());
    }

    [Theory]
    [MemberData(nameof(GradeVectors.GpaCaseIds), MemberType = typeof(GradeVectors))]
    public void GpaVector(string caseId)
    {
        var vector = GradeVectors.Gpa(caseId);

        var actual = GradeEngine.AggregateGpa(
            vector.Classes.Select(c => (c.Gpa, c.CreditHours)));

        Assert.Equal(vector.Expect.Gpa, actual);
    }

    [Theory]
    [MemberData(nameof(GradeVectors.TargetCaseIds), MemberType = typeof(GradeVectors))]
    public void TargetVector(string caseId)
    {
        var vector = GradeVectors.Target(caseId);
        var input = GradeVectors.ToClass(caseId, 3, null, vector.Categories);

        var result = TargetGradeSolver.Solve(input, vector.Target);

        Assert.Equal(Enum.Parse<TargetStatus>(vector.Expect.Status), result.Status);
        Assert.Equal(vector.Expect.TargetPercent, result.TargetPercent);

        if (vector.Expect.Needed is null) Assert.Null(result.NeededOnRemaining);
        else Assert.Equal(vector.Expect.Needed, result.NeededOnRemaining);
    }

    [Fact]
    public void VectorFileIsTheExpectedVersion()
    {
        // A bumped version means the contract changed; both suites must be updated together.
        Assert.Equal(1, GradeVectors.File.Version);
    }

    [Fact]
    public void EveryVectorCaseIdIsUnique()
    {
        var ids = GradeVectors.File.ClassCases.Select(c => c.Id)
            .Concat(GradeVectors.File.GpaCases.Select(c => c.Id))
            .Concat(GradeVectors.File.TargetCases.Select(c => c.Id))
            .ToList();

        Assert.Equal(ids.Count, ids.Distinct(StringComparer.Ordinal).Count());
    }
}
