using System.Text.Json;
using GradeCalculator.API.DTOs.Responses;
using GradeCalculator.API.Services.Interfaces;

namespace GradeCalculator.API.Services;

/// <summary>
/// Hybrid syllabus parser.
/// 1. Deterministic pass (regex + exact math) — zero tokens. If category weights
///    reconcile to 100%, the LLM is never called.
/// 2. LLM fallback — only sees a trimmed, grading-relevant excerpt, runs in strict
///    JSON mode at temperature 0 with a tight token budget, and is validated
///    server-side (weights must sum to 100). One retry with error feedback.
/// Deterministic findings (class name, credits, grade scale) always win over
/// LLM guesses when both exist.
/// </summary>
public class SyllabusParserService : ISyllabusParserService
{
    private const int MaxOutputTokens = 600;

    private readonly IOpenAiService _openAiService;
    private readonly ILogger<SyllabusParserService> _logger;

    public SyllabusParserService(IOpenAiService openAiService, ILogger<SyllabusParserService> logger)
    {
        _openAiService = openAiService;
        _logger = logger;
    }

    public async Task<SyllabusParseResponse> ParseSyllabusAsync(string syllabusText)
    {
        // ---- Pass 1: deterministic, zero tokens ----
        var det = DeterministicSyllabusParser.Parse(syllabusText);

        if (det.CategoriesConfident)
        {
            _logger.LogInformation(
                "Syllabus parsed deterministically ({Count} categories, 0 tokens used)",
                det.Categories.Count);

            return new SyllabusParseResponse
            {
                ClassName = det.ClassName,
                CreditHours = det.CreditHours,
                Categories = det.Categories,
                GradeScale = det.GradeScale
            };
        }

        // ---- Pass 2: token-conscious LLM fallback ----
        var trimmed = DeterministicSyllabusParser.TrimForLlm(syllabusText);
        _logger.LogInformation(
            "Deterministic parse inconclusive — LLM fallback on trimmed excerpt ({Trimmed}/{Full} chars)",
            trimmed.Length, syllabusText.Length);

        var llm = await ParseWithLlmAsync(trimmed);

        if (llm == null || llm.Categories.Count == 0)
        {
            // Last resort: return whatever the deterministic pass scraped together
            // so the user can correct it in the UI instead of getting an error.
            if (det.Categories.Count > 0)
            {
                _logger.LogWarning("LLM fallback failed — returning partial deterministic result");
                return new SyllabusParseResponse
                {
                    ClassName = det.ClassName,
                    CreditHours = det.CreditHours,
                    Categories = DeterministicSyllabusParser.NormalizeTo100(det.Categories),
                    GradeScale = det.GradeScale
                };
            }

            throw new InvalidOperationException(
                "Could not extract grading categories from this syllabus. " +
                "Try pasting just the grading/evaluation section.");
        }

        // Merge: deterministic wins where it found something concrete.
        return new SyllabusParseResponse
        {
            ClassName = det.ClassName ?? llm.ClassName,
            CreditHours = det.CreditHours ?? llm.CreditHours,
            Categories = DeterministicSyllabusParser.NormalizeTo100(llm.Categories),
            GradeScale = det.GradeScale ?? llm.GradeScale
        };
    }

    // ---------------- LLM fallback ----------------

    private const string SystemPrompt =
        """
        You extract grading information from course syllabi. Respond with ONLY a JSON object:
        {
          "className": string|null,
          "creditHours": number|null,
          "categories": [ { "name": string, "weight": number } ],
          "gradeScale": { "aPlus": n, "a": n, "aMinus": n, "bPlus": n, "b": n, "bMinus": n,
                          "cPlus": n, "c": n, "cMinus": n, "dPlus": n, "d": n, "dMinus": n } | null
        }
        Rules:
        - weights are percentages and MUST sum to exactly 100.
        - If the syllabus uses points, convert each category to a percentage of total points.
        - Merge numbered duplicates ("Exam 1", "Exam 2" -> "Exams") only when they share one weight pool.
        - gradeScale values are the MINIMUM percentage for each letter; null if the syllabus has no scale.
        - creditHours is an integer 1-12, null if not stated.
        - Do not invent categories that are not in the text.
        """;

    private async Task<LlmParsed?> ParseWithLlmAsync(string trimmedSyllabus)
    {
        var userContent = "SYLLABUS EXCERPT:\n" + trimmedSyllabus;

        for (var attempt = 1; attempt <= 2; attempt++)
        {
            try
            {
                var raw = await _openAiService.GetJsonCompletionAsync(SystemPrompt, userContent, MaxOutputTokens);
                var parsed = Deserialize(raw);

                var error = Validate(parsed);
                if (error == null) return parsed;

                _logger.LogWarning("LLM syllabus output invalid (attempt {Attempt}): {Error}", attempt, error);
                userContent = $"Your previous answer was invalid: {error}. Fix it.\n\nSYLLABUS EXCERPT:\n{trimmedSyllabus}";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "LLM syllabus parse attempt {Attempt} failed", attempt);
                if (attempt == 2) return null;
            }
        }

        return null;
    }

    private static LlmParsed? Deserialize(string raw)
    {
        raw = raw.Trim();
        if (raw.StartsWith("```"))
        {
            raw = raw.TrimStart('`');
            if (raw.StartsWith("json")) raw = raw[4..];
            raw = raw.TrimEnd('`').Trim();
        }

        var parsed = JsonSerializer.Deserialize<LlmParsedRaw>(raw, new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        });

        if (parsed == null) return null;

        return new LlmParsed
        {
            ClassName = string.IsNullOrWhiteSpace(parsed.ClassName) ? null : parsed.ClassName.Trim(),
            CreditHours = parsed.CreditHours is >= 1 and <= 12 ? parsed.CreditHours : null,
            Categories = parsed.Categories?
                .Where(c => !string.IsNullOrWhiteSpace(c.Name) && c.Weight > 0)
                .Select(c => new ParsedCategory { Name = c.Name.Trim(), Weight = c.Weight })
                .ToList() ?? new List<ParsedCategory>(),
            GradeScale = parsed.GradeScale == null ? null : new ParsedGradeScale
            {
                APlus = parsed.GradeScale.APlus, A = parsed.GradeScale.A, AMinus = parsed.GradeScale.AMinus,
                BPlus = parsed.GradeScale.BPlus, B = parsed.GradeScale.B, BMinus = parsed.GradeScale.BMinus,
                CPlus = parsed.GradeScale.CPlus, C = parsed.GradeScale.C, CMinus = parsed.GradeScale.CMinus,
                DPlus = parsed.GradeScale.DPlus, D = parsed.GradeScale.D, DMinus = parsed.GradeScale.DMinus
            }
        };
    }

    private static string? Validate(LlmParsed? parsed)
    {
        if (parsed == null) return "response was not valid JSON";
        if (parsed.Categories.Count == 0) return "categories array was empty";
        if (parsed.Categories.Count > 20) return "too many categories (max 20)";
        if (parsed.Categories.Any(c => c.Weight <= 0 || c.Weight > 100))
            return "each category weight must be between 0 and 100";

        var sum = parsed.Categories.Sum(c => c.Weight);
        if (Math.Abs(sum - 100m) > 3m)
            return $"weights sum to {sum}, they must sum to 100";

        return null;
    }

    private sealed class LlmParsed
    {
        public string? ClassName { get; set; }
        public int? CreditHours { get; set; }
        public List<ParsedCategory> Categories { get; set; } = new();
        public ParsedGradeScale? GradeScale { get; set; }
    }

    private sealed class LlmParsedRaw
    {
        public string? ClassName { get; set; }
        public int? CreditHours { get; set; }
        public List<RawCategory>? Categories { get; set; }
        public RawScale? GradeScale { get; set; }

        public sealed class RawCategory
        {
            public string Name { get; set; } = "";
            public decimal Weight { get; set; }
        }

        public sealed class RawScale
        {
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
    }
}
