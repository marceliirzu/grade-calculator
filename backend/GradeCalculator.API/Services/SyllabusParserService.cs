using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using GradeCalculator.API.Configuration;
using GradeCalculator.API.Data;
using GradeCalculator.API.DTOs.Responses;
using GradeCalculator.API.Models;
using GradeCalculator.API.Services.Interfaces;

namespace GradeCalculator.API.Services;

/// <summary>
/// Extracts grading categories from a syllabus, spending as few tokens as possible.
///
/// Four tiers, cheapest first — each one only runs if the previous failed:
///
///   1. Deterministic regex pass. Zero tokens. When the weights it finds reconcile to 100%
///      the answer is not a guess, and no LLM is involved at all. This handles the majority
///      of real syllabi, because a grading table is a structured thing.
///   2. Shared parse cache, keyed by a hash of the normalised text. Zero tokens. Students in
///      one course upload the same document, so the second one through is free.
///   3. LLM on a *trimmed excerpt* — the grading-relevant lines only, hard-capped — in strict
///      JSON mode at temperature 0.
///   4. Partial deterministic output, so a failed parse still gives the user something to
///      correct rather than an error.
///
/// Every tier is measured. <see cref="ILlmUsageTracker"/> records what was spent *and* what was
/// avoided, so the saving is a number in the database rather than a claim in a comment.
/// </summary>
public sealed class SyllabusParserService : ISyllabusParserService
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    /// <summary>Collapses whitespace so cosmetically different copies still hash equal.</summary>
    private static readonly Regex WhitespaceRun = new(@"\s+", RegexOptions.Compiled);

    /// <summary>
    /// Typical cost of the LLM path, used to attribute a saving to cache and deterministic hits.
    /// Only ever reported as "tokens saved" — never billed, never used for the quota.
    /// </summary>
    private const int AssumedLlmCallCost = 1800;

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
        - creditHours may be fractional (1.5); null if not stated.
        - Do not invent categories that are not in the text.
        """;

    private readonly AppDbContext _db;
    private readonly ILlmClient _llm;
    private readonly ILlmUsageTracker _usage;
    private readonly LlmSettings _settings;
    private readonly ILogger<SyllabusParserService> _logger;

    public SyllabusParserService(
        AppDbContext db,
        ILlmClient llm,
        ILlmUsageTracker usage,
        IOptions<LlmSettings> settings,
        ILogger<SyllabusParserService> logger)
    {
        _db = db;
        _llm = llm;
        _usage = usage;
        _settings = settings.Value;
        _logger = logger;
    }

    public async Task<SyllabusParseResponse> ParseSyllabusAsync(
        string syllabusText,
        int? userId,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(syllabusText))
            throw new ValidationFailedException("The syllabus text is empty.");

        // ---- Tier 1: deterministic, zero tokens ----
        var deterministic = DeterministicSyllabusParser.Parse(syllabusText);

        if (deterministic.CategoriesConfident)
        {
            _logger.LogInformation(
                "Syllabus parsed deterministically ({Count} categories, 0 tokens).",
                deterministic.Categories.Count);

            await _usage.RecordAvoidedAsync(userId, LlmFeature.SyllabusParse, "none", AssumedLlmCallCost, cancellationToken);

            return new SyllabusParseResponse
            {
                ClassName = deterministic.ClassName,
                CreditHours = deterministic.CreditHours,
                Categories = deterministic.Categories,
                GradeScale = deterministic.GradeScale,
                Source = "deterministic",
                TokensUsed = 0,
                Notes = { "Read directly from the grading table — no AI needed." },
            };
        }

        // ---- Tier 2: shared cache, zero tokens ----
        var hash = ComputeHash(syllabusText);
        var cached = await _db.SyllabusParseCaches.FirstOrDefaultAsync(c => c.ContentHash == hash, cancellationToken);

        if (cached is not null)
        {
            var restored = Deserialize(cached.ResultJson);
            if (restored is not null)
            {
                cached.HitCount++;
                cached.LastHitAt = DateTime.UtcNow;
                await SaveQuietlyAsync(cancellationToken);

                await _usage.RecordAvoidedAsync(userId, LlmFeature.SyllabusParse, cached.Model ?? "none", cached.TokensSpent, cancellationToken);

                _logger.LogInformation("Syllabus parse served from cache (hit #{Hits}, 0 tokens).", cached.HitCount);

                restored.Source = "cache";
                restored.TokensUsed = 0;
                restored.Notes = new List<string> { "Recognised from a previously parsed syllabus." };
                return restored;
            }

            // A corrupt cache row must not poison every future request for this document.
            _logger.LogWarning("Discarding unreadable syllabus cache entry {Id}.", cached.Id);
            _db.SyllabusParseCaches.Remove(cached);
            await SaveQuietlyAsync(cancellationToken);
        }

        // ---- Tier 3: LLM on a trimmed excerpt ----
        var llmAttemptedAndFailed = false;

        if (_llm.IsConfigured && userId is not null)
        {
            await _usage.EnsureWithinQuotaAsync(userId.Value, cancellationToken);

            var excerpt = DeterministicSyllabusParser.TrimForLlm(syllabusText, _settings.MaxInputChars);

            _logger.LogInformation(
                "Deterministic parse inconclusive; calling LLM on {Trimmed} of {Full} chars.",
                excerpt.Length, syllabusText.Length);

            var parsed = await ParseWithLlmAsync(excerpt, userId, cancellationToken);

            if (parsed is not null)
            {
                var response = Merge(deterministic, parsed.Value.Result);
                response.Source = "llm";
                response.TokensUsed = parsed.Value.Tokens;
                response.Notes.Add($"Extracted by AI from a {excerpt.Length}-character excerpt.");

                await CacheAsync(hash, response, "llm", _llm.Model, parsed.Value.Tokens, cancellationToken);
                return response;
            }

            // The model was reached but produced nothing usable. Remembered so the final error
            // can say what actually happened rather than blaming the syllabus.
            llmAttemptedAndFailed = true;
        }

        // ---- Tier 4: partial deterministic output beats an error ----
        if (deterministic.Categories.Count > 0)
        {
            _logger.LogWarning("Falling back to a partial deterministic parse.");

            return new SyllabusParseResponse
            {
                ClassName = deterministic.ClassName,
                CreditHours = deterministic.CreditHours,
                Categories = DeterministicSyllabusParser.NormalizeTo100(deterministic.Categories),
                GradeScale = deterministic.GradeScale,
                Source = "deterministic",
                TokensUsed = 0,
                Notes = { "The weights did not add up to 100%, so they were scaled proportionally. Please check them." },
            };
        }

        // Two very different failures used to share one message. Telling a user "no grading
        // categories could be found" after the model timed out is simply untrue, and sends them
        // off to re-edit a syllabus that was never the problem.
        throw new ValidationFailedException(
            llmAttemptedAndFailed
                ? "The AI could not finish reading this syllabus. Try pasting just the grading " +
                  "or evaluation section, or add the categories by hand."
                : "No grading categories could be found in this syllabus. " +
                  "Try pasting just the grading or evaluation section.");
    }

    // -----------------------------------------------------------------------

    private async Task<(SyllabusParseResponse Result, int Tokens)?> ParseWithLlmAsync(
        string excerpt,
        int? userId,
        CancellationToken cancellationToken)
    {
        var userContent = "SYLLABUS EXCERPT:\n" + excerpt;
        var totalTokens = 0;

        for (var attempt = 0; attempt <= _settings.MaxValidationRetries; attempt++)
        {
            LlmCompletion completion;

            try
            {
                completion = await _llm.CompleteJsonAsync(
                    SystemPrompt, userContent, _settings.MaxOutputTokens, cancellationToken);
            }
            catch (FeatureUnavailableException)
            {
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "LLM syllabus parse failed on attempt {Attempt}.", attempt + 1);
                return null;
            }

            totalTokens += completion.TotalTokens;

            // Recorded even on a failed parse: the tokens were spent regardless of the outcome.
            await _usage.RecordSpendAsync(userId, LlmFeature.SyllabusParse, completion, succeeded: true, cancellationToken);

            var parsed = Deserialize(completion.Content);

            if (parsed is { Categories.Count: > 0 })
            {
                parsed.Categories = DeterministicSyllabusParser.NormalizeTo100(parsed.Categories);
                return (parsed, totalTokens);
            }

            if (attempt < _settings.MaxValidationRetries)
            {
                // One corrective retry. Telling the model what was wrong is far cheaper than
                // resending the whole excerpt blind, and stops an endless retry loop.
                userContent =
                    "SYLLABUS EXCERPT:\n" + excerpt +
                    "\n\nYour previous reply was not valid JSON with a non-empty \"categories\" array. " +
                    "Return only the JSON object described in the system message.";
            }
        }

        _logger.LogWarning("LLM returned no usable categories after {Attempts} attempt(s).",
            _settings.MaxValidationRetries + 1);

        return null;
    }

    /// <summary>
    /// Deterministic findings win over LLM guesses wherever both exist — a regex that matched an
    /// explicit "3 credit hours" is simply more reliable than a model inferring it.
    /// </summary>
    private static SyllabusParseResponse Merge(DeterministicSyllabusParser.Result deterministic, SyllabusParseResponse llm) => new()
    {
        ClassName = deterministic.ClassName ?? llm.ClassName,
        CreditHours = deterministic.CreditHours ?? llm.CreditHours,
        Categories = llm.Categories,
        GradeScale = deterministic.GradeScale ?? llm.GradeScale,
    };

    private async Task CacheAsync(
        string hash,
        SyllabusParseResponse response,
        string source,
        string model,
        int tokensSpent,
        CancellationToken cancellationToken)
    {
        _db.SyllabusParseCaches.Add(new SyllabusParseCache
        {
            ContentHash = hash,
            ResultJson = JsonSerializer.Serialize(response, Json),
            Source = source,
            Model = model,
            TokensSpent = tokensSpent,
            HitCount = 0,
            CreatedAt = DateTime.UtcNow,
            LastHitAt = DateTime.UtcNow,
        });

        // A lost cache write costs tokens next time; it must not cost the user their parse.
        await SaveQuietlyAsync(cancellationToken);
    }

    private async Task SaveQuietlyAsync(CancellationToken cancellationToken)
    {
        try
        {
            await _db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException ex)
        {
            _logger.LogWarning(ex, "Syllabus cache write failed; continuing without caching.");
        }
    }

    private static SyllabusParseResponse? Deserialize(string raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;

        // JSON mode should return a bare object, but a stray prose wrapper is cheap to survive.
        var start = raw.IndexOf('{');
        var end = raw.LastIndexOf('}');
        if (start < 0 || end <= start) return null;

        try
        {
            return JsonSerializer.Deserialize<SyllabusParseResponse>(raw[start..(end + 1)], Json);
        }
        catch (JsonException)
        {
            return null;
        }
    }

    /// <summary>
    /// SHA-256 of the case-folded, whitespace-collapsed text. Normalising first is what makes
    /// the cache actually hit: the same syllabus pasted from a PDF and from a web page differs
    /// only in whitespace.
    /// </summary>
    private static string ComputeHash(string text)
    {
        var normalized = WhitespaceRun.Replace(text, " ").Trim().ToLowerInvariant();
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(normalized));

        return Convert.ToHexString(bytes).ToLowerInvariant();
    }
}
