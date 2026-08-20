namespace GradeCalculator.API.Configuration;

/// <summary>
/// Settings for Claude, and — more importantly — the guard rails that stop it being expensive.
///
/// Every limit here exists because an AI feature with no ceiling is an unbounded bill attached
/// to an internet-facing endpoint.
/// </summary>
public sealed class LlmSettings
{
    public const string SectionName = "Llm";

    /// <summary>Anthropic API key (<c>sk-ant-...</c>). Set as <c>Llm__ApiKey</c>.</summary>
    public string ApiKey { get; set; } = string.Empty;

    /// <summary>
    /// Claude model id. Sonnet 5 is the deliberate choice: syllabus extraction is a mechanical
    /// task, and Sonnet is materially cheaper than Opus for the same result here.
    ///
    /// Use the exact id — never append a date suffix.
    /// </summary>
    public string Model { get; set; } = "claude-sonnet-5";

    /// <summary>
    /// Hard cap on characters sent to Claude. The deterministic pre-pass trims a syllabus to its
    /// grading section first; this is the backstop for when that pass finds no anchor and would
    /// otherwise forward an entire 40-page PDF.
    /// </summary>
    public int MaxInputChars { get; set; } = 6000;

    /// <summary>Output ceiling. A category list plus a grade scale fits comfortably in this.</summary>
    public int MaxOutputTokens { get; set; } = 8000;

    /// <summary>Ceiling for a single advisor reply.</summary>
    public int MaxAdvisorOutputTokens { get; set; } = 4000;

    /// <summary>
    /// Conversation turns retained before the oldest are dropped. History is resent in full on
    /// every turn, so this is a direct multiplier on cost — an unbounded transcript makes turn
    /// 30 cost thirty times turn 1.
    /// </summary>
    public int MaxHistoryTurns { get; set; } = 8;

    /// <summary>
    /// Per-user daily token budget across all features. Zero disables the check.
    ///
    /// Sized against Sonnet 5 pricing so a single user cannot run up a meaningful bill in a day
    /// even if every request misses the deterministic parser and the cache.
    /// </summary>
    public int DailyTokenLimitPerUser { get; set; } = 40000;

    /// <summary>Request timeout. A hung provider call must not hold a request thread forever.</summary>
    public int TimeoutSeconds { get; set; } = 120;

    /// <summary>Retries for a <em>malformed</em> response. Transport failures are retried by the SDK.</summary>
    public int MaxValidationRetries { get; set; } = 1;

    /// <summary>
    /// True once a usable key is present. When false, AI-backed features report "not configured"
    /// rather than throwing — the deterministic parser still works, so the app stays useful
    /// without a key.
    /// </summary>
    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(ApiKey) && !ApiKey.StartsWith("SET_", StringComparison.Ordinal);
}
