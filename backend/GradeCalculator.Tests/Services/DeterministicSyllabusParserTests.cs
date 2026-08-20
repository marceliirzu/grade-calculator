using GradeCalculator.API.Services;
using Xunit;

namespace GradeCalculator.Tests.Services;

/// <summary>
/// The server-side deterministic parser is tier 1 of the syllabus cascade — it handles the
/// majority of real syllabi and is what keeps AI spend near zero. It shipped with no tests,
/// which meant a regression here would silently push every parse down to the paid tier, or to
/// the "no categories found" dead end.
/// </summary>
public class DeterministicSyllabusParserTests
{
    [Fact]
    public void ParsesAStandardPercentageBreakdown()
    {
        var result = DeterministicSyllabusParser.Parse("""
            MATH 2413 - Calculus I
            3 Credit Hours

            Grading:
            Homework: 25%
            Quizzes: 15%
            Midterm Exam: 25%
            Final Exam: 35%
            """);

        Assert.True(result.CategoriesConfident, "weights sum to 100 and should be confident");
        Assert.Equal(4, result.Categories.Count);
        Assert.Equal(100m, result.Categories.Sum(c => c.Weight));
        Assert.Equal(3m, result.CreditHours);
    }

    [Fact]
    public void ParsesADashBulletedList()
    {
        var result = DeterministicSyllabusParser.Parse("""
            Course grade breakdown:
            - Homework: 30%
            - Exams: 50%
            - Participation: 20%
            """);

        Assert.True(result.CategoriesConfident);
        Assert.Equal(3, result.Categories.Count);
    }

    [Fact]
    public void ParsesAPointsBasedSyllabus()
    {
        var result = DeterministicSyllabusParser.Parse("""
            Grading
            Homework          200 points
            Midterm           300 points
            Final Exam        500 points
            """);

        Assert.NotEmpty(result.Categories);
        Assert.Equal(100m, Math.Round(result.Categories.Sum(c => c.Weight)));
    }

    [Fact]
    public void ParsesWeightsWrittenInParentheses()
    {
        var result = DeterministicSyllabusParser.Parse("""
            Assessment
            Problem Sets (40%)
            Midterm Exam (25%)
            Final Exam (35%)
            """);

        Assert.True(result.CategoriesConfident);
        Assert.Equal(3, result.Categories.Count);
    }

    [Fact]
    public void ParsesATableWithDotLeaders()
    {
        var result = DeterministicSyllabusParser.Parse("""
            GRADING
            Labs .................... 20%
            Quizzes ................. 20%
            Midterm ................. 25%
            Final ................... 35%
            """);

        Assert.True(result.CategoriesConfident);
        Assert.Equal(4, result.Categories.Count);
    }

    [Fact]
    public void IsNotConfidentWhenWeightsDoNotReachOneHundred()
    {
        // The whole point of the confidence flag: an incomplete read must fall through to the
        // next tier rather than being presented as a finished answer.
        var result = DeterministicSyllabusParser.Parse("Homework: 30%\nExams: 40%");

        Assert.False(result.CategoriesConfident);
    }

    [Fact]
    public void FindsNothingInProseWithNoGradingTable()
    {
        var result = DeterministicSyllabusParser.Parse("""
            Welcome to the course. Office hours are Tuesdays 2-4pm in Room 210.
            Attendance is expected at every lecture.
            """);

        Assert.False(result.CategoriesConfident);
        Assert.Empty(result.Categories);
    }

    [Fact]
    public void ExtractsAGradeScale()
    {
        var result = DeterministicSyllabusParser.Parse("""
            Homework: 50%
            Exams: 50%

            Grade Scale:
            A: 93-100
            A-: 90-92
            B+: 87-89
            B: 83-86
            C: 73-76
            """);

        Assert.NotNull(result.GradeScale);
        Assert.Equal(93m, result.GradeScale!.A);
    }

    [Fact]
    public void TrimForLlmShrinksALongSyllabusToItsGradingSection()
    {
        var filler = string.Join("\n", Enumerable.Repeat("This is a long policy paragraph about attendance.", 200));

        var full = $"""
            BIOL 1301 - Introductory Biology
            {filler}
            Grading:
            Labs: 40%
            Exams: 60%
            {filler}
            """;

        var trimmed = DeterministicSyllabusParser.TrimForLlm(full, 6000);

        Assert.True(trimmed.Length < full.Length, "trimming should reduce the text");
        Assert.True(trimmed.Length <= 6000, "trimming must respect the character cap");
        Assert.Contains("40%", trimmed);
        Assert.Contains("60%", trimmed);
    }

    [Fact]
    public void NormalizeTo100RescalesProportionally()
    {
        var normalized = DeterministicSyllabusParser.NormalizeTo100(
        [
            new() { Name = "A", Weight = 30m },
            new() { Name = "B", Weight = 30m },
        ]);

        Assert.Equal(100m, Math.Round(normalized.Sum(c => c.Weight)));
    }

    [Fact]
    public void ConvertsAPointBasedGradeScaleUsingTheCategoryTotal()
    {
        // The whole syllabus is in points, including the scale. Previously the scale was
        // discarded and the class silently inherited the standard 93/90/87 percentages.
        var result = DeterministicSyllabusParser.Parse("""
            PHYS 2425
            Grading
            Homework: 100 points
            Midterm: 100 points
            Final: 100 points

            Grade Scale:
            A: 270-300
            B: 240-269
            C: 210-239
            D: 180-209
            """);

        Assert.Equal(300m, result.TotalPoints);
        Assert.NotNull(result.GradeScale);
        Assert.Equal(90m, result.GradeScale!.A);   // 270/300
        Assert.Equal(80m, result.GradeScale.B);    // 240/300
        Assert.Equal(70m, result.GradeScale.C);    // 210/300
        Assert.Equal(60m, result.GradeScale.D);    // 180/300
    }

    [Fact]
    public void IgnoresAPointBasedScaleWhenNoTotalCanBeDerived()
    {
        // Percentage categories give no point total, so there is no denominator. Falling back
        // to the standard scale beats inventing one.
        var result = DeterministicSyllabusParser.Parse("""
            Homework: 50%
            Exams: 50%

            Grade Scale:
            A: 270-300
            B: 240-269
            C: 210-239
            D: 180-209
            """);

        Assert.Null(result.GradeScale);
    }
}
