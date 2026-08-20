using System.Text.Json;
using System.Text.Json.Serialization;
using GradeCalculator.API.Grading;

namespace GradeCalculator.Tests.Grading;

// Shapes mirroring shared/grade-vectors.json. Deliberately loose (nullable, defaulted) so a
// malformed vector fails inside a test with a readable message rather than at load time.

public sealed class VectorItem
{
    public decimal? PointsEarned { get; set; }
    public decimal PointsPossible { get; set; }
}

public sealed class VectorRule
{
    public string Type { get; set; } = "";
    public int Value { get; set; }
    public List<decimal>? WeightDistribution { get; set; }
}

public sealed class VectorCategory
{
    public string Name { get; set; } = "";
    public decimal Weight { get; set; }
    public List<VectorItem> Items { get; set; } = new();
    public List<VectorRule>? Rules { get; set; }
}

public sealed class VectorScale
{
    public decimal? APlusGpaValue { get; set; }
    public decimal? APlus { get; set; }
    public decimal? A { get; set; }
    public decimal? AMinus { get; set; }
    public decimal? BPlus { get; set; }
    public decimal? B { get; set; }
    public decimal? BMinus { get; set; }
    public decimal? CPlus { get; set; }
    public decimal? C { get; set; }
    public decimal? CMinus { get; set; }
    public decimal? DPlus { get; set; }
    public decimal? D { get; set; }
    public decimal? DMinus { get; set; }
}

public sealed class ClassExpectation
{
    public Dictionary<string, decimal?>? CategoryPercents { get; set; }
    public decimal? ClassPercent { get; set; }
    public string? Letter { get; set; }
    public decimal? ClassGpa { get; set; }
    public List<string>? Warnings { get; set; }
}

public sealed class ClassCase
{
    public string Id { get; set; } = "";
    public string? Description { get; set; }
    public decimal CreditHours { get; set; } = 3m;
    public VectorScale? Scale { get; set; }
    public List<VectorCategory> Categories { get; set; } = new();
    public ClassExpectation Expect { get; set; } = new();
}

public sealed class GpaClassEntry
{
    public decimal? Gpa { get; set; }
    public decimal CreditHours { get; set; }
}

public sealed class GpaExpectation
{
    public decimal? Gpa { get; set; }
}

public sealed class GpaCase
{
    public string Id { get; set; } = "";
    public string? Description { get; set; }
    public List<GpaClassEntry> Classes { get; set; } = new();
    public GpaExpectation Expect { get; set; } = new();
}

public sealed class TargetExpectation
{
    public string Status { get; set; } = "";
    public decimal? Needed { get; set; }
    public decimal TargetPercent { get; set; }
}

public sealed class TargetCase
{
    public string Id { get; set; } = "";
    public string? Description { get; set; }
    public string Target { get; set; } = "";
    public List<VectorCategory> Categories { get; set; } = new();
    public TargetExpectation Expect { get; set; } = new();
}

public sealed class VectorFile
{
    public int Version { get; set; }
    public VectorScale DefaultScale { get; set; } = new();
    public List<ClassCase> ClassCases { get; set; } = new();
    public List<GpaCase> GpaCases { get; set; } = new();
    public List<TargetCase> TargetCases { get; set; } = new();
}

/// <summary>
/// Loads shared/grade-vectors.json once and exposes it to the vector-driven tests.
/// </summary>
public static class GradeVectors
{
    private const string FileName = "grade-vectors.json";

    public static readonly VectorFile File = Load();

    private static readonly Dictionary<string, ClassCase> ClassById =
        File.ClassCases.ToDictionary(c => c.Id, StringComparer.Ordinal);

    private static readonly Dictionary<string, GpaCase> GpaById =
        File.GpaCases.ToDictionary(c => c.Id, StringComparer.Ordinal);

    private static readonly Dictionary<string, TargetCase> TargetById =
        File.TargetCases.ToDictionary(c => c.Id, StringComparer.Ordinal);

    public static ClassCase Class(string id) => ClassById[id];

    public static GpaCase Gpa(string id) => GpaById[id];

    public static TargetCase Target(string id) => TargetById[id];

    // xUnit MemberData yields only the case id, so failures name the offending vector
    // ("basic-two-categories") instead of dumping an unreadable serialized object graph.
    public static IEnumerable<object[]> ClassCaseIds() => File.ClassCases.Select(c => new object[] { c.Id });

    public static IEnumerable<object[]> GpaCaseIds() => File.GpaCases.Select(c => new object[] { c.Id });

    public static IEnumerable<object[]> TargetCaseIds() => File.TargetCases.Select(c => new object[] { c.Id });

    private static VectorFile Load()
    {
        var path = Path.Combine(AppContext.BaseDirectory, FileName);
        if (!System.IO.File.Exists(path))
        {
            throw new FileNotFoundException(
                $"Golden vectors not found at '{path}'. They are linked into the test output by " +
                "GradeCalculator.Tests.csproj from shared/grade-vectors.json.", path);
        }

        var options = new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true,
            NumberHandling = JsonNumberHandling.AllowReadingFromString,
            ReadCommentHandling = JsonCommentHandling.Skip,
        };

        return JsonSerializer.Deserialize<VectorFile>(System.IO.File.ReadAllText(path), options)
               ?? throw new InvalidOperationException("Golden vector file deserialized to null.");
    }

    // ---- Mapping from vector shapes onto engine inputs ----

    public static GradeScaleInput ToScale(VectorScale? overrides)
    {
        var b = File.DefaultScale;
        var o = overrides;

        decimal Pick(Func<VectorScale, decimal?> get, decimal fallback) =>
            (o is null ? null : get(o)) ?? get(b) ?? fallback;

        return new GradeScaleInput(
            APlusGpaValue: Pick(s => s.APlusGpaValue, 4.0m),
            APlus: Pick(s => s.APlus, 97m),
            A: Pick(s => s.A, 93m),
            AMinus: Pick(s => s.AMinus, 90m),
            BPlus: Pick(s => s.BPlus, 87m),
            B: Pick(s => s.B, 83m),
            BMinus: Pick(s => s.BMinus, 80m),
            CPlus: Pick(s => s.CPlus, 77m),
            C: Pick(s => s.C, 73m),
            CMinus: Pick(s => s.CMinus, 70m),
            DPlus: Pick(s => s.DPlus, 67m),
            D: Pick(s => s.D, 63m),
            DMinus: Pick(s => s.DMinus, 60m));
    }

    public static CategoryInput ToCategory(VectorCategory category, int id)
    {
        var items = category.Items
            .Select((item, index) => new GradeItemInput(
                PointsEarned: item.PointsEarned,
                PointsPossible: item.PointsPossible,
                SortOrder: index,
                Id: index))
            .ToList();

        var rules = (category.Rules ?? new List<VectorRule>())
            .Select((rule, index) => new RuleInput(
                Kind: Enum.Parse<RuleKind>(rule.Type, ignoreCase: true),
                Value: rule.Value,
                WeightDistribution: rule.WeightDistribution,
                Id: index))
            .ToList();

        return new CategoryInput(category.Name, category.Weight, items, rules, id);
    }

    public static ClassInput ToClass(string name, decimal creditHours, VectorScale? scale, List<VectorCategory> categories) =>
        new(name,
            creditHours,
            ToScale(scale),
            categories.Select((c, i) => ToCategory(c, i)).ToList());
}
