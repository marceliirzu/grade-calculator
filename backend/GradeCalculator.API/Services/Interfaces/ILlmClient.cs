using GradeCalculator.API.DTOs.Responses;

namespace GradeCalculator.API.Services.Interfaces;

/// <summary>
/// One provider call and what it cost.
///
/// Token counts come from the provider's own <c>usage</c> block, never from an estimate. A
/// quota enforced against guessed token counts drifts from the real bill, and the direction of
/// the drift is not predictable.
/// </summary>
public sealed record LlmCompletion(
    string Content,
    int PromptTokens,
    int CompletionTokens,
    string Model)
{
    public int TotalTokens => PromptTokens + CompletionTokens;

    public static LlmCompletion Empty(string model) => new(string.Empty, 0, 0, model);
}

public interface ILlmClient
{
    /// <summary>False when no API key is configured; callers degrade instead of failing.</summary>
    bool IsConfigured { get; }

    string Model { get; }

    /// <summary>
    /// Strict-JSON completion at temperature 0, for structured extraction. JSON mode plus a
    /// deterministic temperature is what makes a parse reproducible enough to cache.
    /// </summary>
    Task<LlmCompletion> CompleteJsonAsync(
        string systemPrompt,
        string userContent,
        int maxOutputTokens,
        CancellationToken cancellationToken = default);

    /// <summary>Conversational completion for the grade advisor.</summary>
    Task<LlmCompletion> CompleteChatAsync(
        string systemPrompt,
        IReadOnlyList<ChatMessageDto> history,
        int maxOutputTokens,
        CancellationToken cancellationToken = default);
}
