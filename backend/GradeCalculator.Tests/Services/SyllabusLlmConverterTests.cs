using GradeCalculator.API.DTOs.Responses;
using GradeCalculator.API.Services;
using Xunit;

namespace GradeCalculator.Tests.Services;

/// <summary>
/// Point-to-percentage conversion for syllabi that grade out of a point total.
///
/// This arithmetic decides every letter grade in such a class, and it fails silently: a scale
/// converted against the wrong denominator still looks like a plausible scale, and the student
/// only finds out when the app tells them they have a B and the registrar says A.
/// </summary>
public class SyllabusLlmConverterTests
{
    private static SyllabusLlmReply Reply(
        decimal? totalPoints = null,
        List<SyllabusLlmCategory>? categories = null,
        ParsedGradeScale? scale = null,
        string? unit = null) => new()
        {
            TotalPoints = totalPoints,
            Categories = categories ?? new List<SyllabusLlmCategory>(),
            GradeScale = scale,
            GradeScaleUnit = unit,
        };

    private static SyllabusLlmCategory Points(string name, decimal points) =>
        new() { Name = name, Points = points };

    private static SyllabusLlmCategory Percent(string name, decimal weight) =>
        new() { Name = name, Weight = weight };

    // ---- Categories ----

    [Fact]
    public void ConvertsPointBasedCategoriesToPercentages()
    {
        var result = SyllabusLlmConverter.Convert(Reply(categories:
        [
            Points("Homework", 200),
            Points("Midterm", 300),
            Points("Final", 500),
        ]));

        var byName = result.Categories.ToDictionary(c => c.Name, c => c.Weight);

        Assert.Equal(20m, byName["Homework"]);
        Assert.Equal(30m, byName["Midterm"]);
        Assert.Equal(50m, byName["Final"]);
        Assert.Equal(1000m, result.TotalPoints);
    }

    [Fact]
    public void PrefersAStatedTotalOverTheSumOfCategories()
    {
        // A syllabus that says "1000 points total" but lists 900 has unlisted points (extra
        // credit, a dropped quiz). The stated total is what the grade scale was written against.
        var result = SyllabusLlmConverter.Convert(Reply(
            totalPoints: 1000,
            categories: [Points("Exams", 600), Points("Homework", 300)]));

        Assert.Equal(1000m, result.TotalPoints);

        var exams = result.Categories.Single(c => c.Name == "Exams");

        // 600/1000 = 60%, then normalised across the 90% actually accounted for.
        Assert.True(exams.Weight > 60m, "weights are normalised to 100 after conversion");
    }

    [Fact]
    public void LeavesPercentageCategoriesAlone()
    {
        var result = SyllabusLlmConverter.Convert(Reply(categories:
        [
            Percent("Homework", 40),
            Percent("Exams", 60),
        ]));

        Assert.Equal(40m, result.Categories.Single(c => c.Name == "Homework").Weight);
        Assert.Null(result.TotalPoints);
    }

    [Fact]
    public void DropsACategoryWithNeitherWeightNorPoints()
    {
        // Storing it as zero would silently shrink every other category once normalised.
        var result = SyllabusLlmConverter.Convert(Reply(categories:
        [
            Percent("Real", 100),
            new SyllabusLlmCategory { Name = "Mystery" },
        ]));

        Assert.Single(result.Categories);
        Assert.Equal("Real", result.Categories[0].Name);
    }

    // ---- Grade scale ----

    [Fact]
    public void ConvertsAPointBasedGradeScale()
    {
        // The case that prompted this: "A+ = 285, A = 275, B = 250, C = 225" out of 300.
        var result = SyllabusLlmConverter.Convert(Reply(
            totalPoints: 300,
            categories: [Points("Everything", 300)],
            unit: "points",
            scale: new ParsedGradeScale { APlus = 285, A = 275, B = 250, C = 225 }));

        Assert.NotNull(result.GradeScale);
        Assert.Equal(95m, result.GradeScale!.APlus);       // 285/300
        Assert.Equal(91.67m, result.GradeScale.A);          // 275/300
        Assert.Equal(83.33m, result.GradeScale.B);          // 250/300
        Assert.Equal(75m, result.GradeScale.C);             // 225/300
        Assert.Contains(result.Notes, n => n.Contains("converted from points"));
    }

    [Fact]
    public void TreatsAnOutOfRangeScaleAsPointsEvenIfLabelledPercent()
    {
        // Models mislabel the unit more often than they misread the digits, and a threshold
        // above 100 cannot be a percentage whatever it was called.
        var result = SyllabusLlmConverter.Convert(Reply(
            totalPoints: 500,
            categories: [Points("Everything", 500)],
            unit: "percent",
            scale: new ParsedGradeScale { A = 450, B = 400, C = 350 }));

        Assert.NotNull(result.GradeScale);
        Assert.Equal(90m, result.GradeScale!.A);
    }

    [Fact]
    public void DiscardsAPointScaleWhenNoTotalIsKnown()
    {
        // Inventing a denominator would be worse than falling back to the standard scale.
        var result = SyllabusLlmConverter.Convert(Reply(
            categories: [Percent("Everything", 100)],
            unit: "points",
            scale: new ParsedGradeScale { A = 275, B = 250, C = 225 }));

        Assert.Null(result.GradeScale);
        Assert.Contains(result.Notes, n => n.Contains("no point total"));
    }

    [Fact]
    public void KeepsAPercentageScaleUnchanged()
    {
        var result = SyllabusLlmConverter.Convert(Reply(
            categories: [Percent("Everything", 100)],
            unit: "percent",
            scale: new ParsedGradeScale { A = 93, AMinus = 90, B = 83 }));

        Assert.NotNull(result.GradeScale);
        Assert.Equal(93m, result.GradeScale!.A);
        Assert.Empty(result.Notes);
    }

    [Fact]
    public void DiscardsAScaleThatDoesNotDescend()
    {
        // A misread scale reports the wrong letter for every grade in the class.
        var result = SyllabusLlmConverter.Convert(Reply(
            categories: [Percent("Everything", 100)],
            unit: "percent",
            scale: new ParsedGradeScale { A = 80, AMinus = 90, B = 70 }));

        Assert.Null(result.GradeScale);
        Assert.Contains(result.Notes, n => n.Contains("descend"));
    }

    [Fact]
    public void DiscardsAScaleWithTooFewAnchors()
    {
        var result = SyllabusLlmConverter.Convert(Reply(
            categories: [Percent("Everything", 100)],
            unit: "percent",
            scale: new ParsedGradeScale { A = 90, B = 80 }));

        Assert.Null(result.GradeScale);
    }

    [Fact]
    public void CapsAThresholdThatExceedsTheTotal()
    {
        // Extra credit can put a band above the nominal total; over 100% is unreachable.
        var result = SyllabusLlmConverter.Convert(Reply(
            totalPoints: 100,
            categories: [Points("Everything", 100)],
            unit: "points",
            scale: new ParsedGradeScale { APlus = 105, A = 93, AMinus = 90 }));

        Assert.NotNull(result.GradeScale);
        Assert.Equal(100m, result.GradeScale!.APlus);
    }

    [Fact]
    public void HandlesAnEmptyReplyWithoutThrowing()
    {
        var result = SyllabusLlmConverter.Convert(Reply());

        Assert.Empty(result.Categories);
        Assert.Null(result.GradeScale);
    }
}
