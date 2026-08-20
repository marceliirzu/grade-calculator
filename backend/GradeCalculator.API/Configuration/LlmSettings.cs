namespace GradeCalculator.API.Configuration;

/// <summary>
/// Settings for the OpenAI-compatible provider, and — more importantly — the guard rails that
/// stop it from being expensive.
///
/// Every limit here exists because an LLM feature with no ceiling is an unbounded bill attached
/// to an anonymous internet endpoint.
/// </summary>
public sealed class LlmSettings
{
    public const string SectionName = "Llm";

    public string ApiKey { get; set; } = string.Empty;

    public string BaseUrl { get; set; } = "https://api.openai.com/v1/";

    /// <summary>
    /// Cheapest model that reliably does structured extraction. Syllabus parsing is a
    /// mechanical task, not a reasoning one, so a larger model buys nothing here.
    /// </summary>
    public string Model { get; set; } = "gpt-4o-mini";

    /// <summary>
    /// Hard cap on characters sent to the provider. The deterministic pre-pass trims a syllabus
    /// to its grading section first; this is the backstop for when that pass finds no anchor
    /// and would otherwise forward an entire 40-page PDF.
    /// </summary>
    public int MaxInputChars { get; set; } = 6000;

    /// <summary>Output ceiling. A category list plus a grade scale fits comfortably in this.</summary>
    public int MaxOutputTokens { get; set; } = 700;

    /// <summary>Ceiling for a single advisor reply.</summary>
    public int MaxAdvisorOutputTokens { get; set; } = 500;

    /// <summary>
    /// Conversation turns retained before the oldest are dropped. History is resent in full on
    /// every turn, so this is a direct multiplier on cost — an unbounded transcript makes turn
    /// 30 cost thirty times turn 1.
    /// </summary>
    public int MaxHistoryTurns { get; set; } = 8;

    /// <summary>Per-user daily token budget across all features. Zero disables the check.</summary>
    public int DailyTokenLimitPerUser { get; set; } = 40000;

    /// <summary>Request timeout. A hung provider call must not hold a request thread forever.</summary>
    public int TimeoutSeconds { get; set; } = 30;

    /// <summary>Retries for a *malformed* response. Transport failures are not retried here.</summary>
    public int MaxValidationRetries { get; set; } = 1;

    /// <summary>
    /// True once a usable key is present. When false, LLM-backed features return a clear
    /// "not configured" rather than throwing — the deterministic parser still works, so the
    /// app stays useful without a key.
    /// </summary>
    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(ApiKey) && !ApiKey.StartsWith("SET_", StringComparison.Ordinal);
}
