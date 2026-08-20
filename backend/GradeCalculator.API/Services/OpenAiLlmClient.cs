using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Options;
using GradeCalculator.API.Configuration;
using GradeCalculator.API.DTOs.Responses;
using GradeCalculator.API.Services.Interfaces;

namespace GradeCalculator.API.Services;

/// <summary>
/// Thin client for the OpenAI chat-completions API.
///
/// Deliberately thin: it owns transport, timeouts and token accounting, and nothing else. All
/// prompt construction, caching and validation lives in the feature services, so the expensive
/// decisions (should we call at all? with how much text?) are made before this class is reached.
/// </summary>
public sealed class OpenAiLlmClient : ILlmClient
{
    private static readonly JsonSerializerOptions SerializerOptions = new(JsonSerializerDefaults.Web);

    private readonly HttpClient _http;
    private readonly LlmSettings _settings;
    private readonly ILogger<OpenAiLlmClient> _logger;

    public OpenAiLlmClient(HttpClient http, IOptions<LlmSettings> settings, ILogger<OpenAiLlmClient> logger)
    {
        _settings = settings.Value;
        _logger = logger;
        _http = http;

        _http.BaseAddress = new Uri(_settings.BaseUrl);
        _http.Timeout = TimeSpan.FromSeconds(_settings.TimeoutSeconds);

        if (_settings.IsConfigured)
        {
            _http.DefaultRequestHeaders.Authorization =
                new AuthenticationHeaderValue("Bearer", _settings.ApiKey);
        }
    }

    public bool IsConfigured => _settings.IsConfigured;

    public string Model => _settings.Model;

    public Task<LlmCompletion> CompleteJsonAsync(
        string systemPrompt,
        string userContent,
        int maxOutputTokens,
        CancellationToken cancellationToken = default)
    {
        var request = new
        {
            model = _settings.Model,
            messages = new object[]
            {
                new { role = "system", content = systemPrompt },
                new { role = "user", content = userContent },
            },
            max_tokens = maxOutputTokens,
            temperature = 0.0,
            response_format = new { type = "json_object" },
        };

        return SendAsync(request, cancellationToken);
    }

    public Task<LlmCompletion> CompleteChatAsync(
        string systemPrompt,
        IReadOnlyList<ChatMessageDto> history,
        int maxOutputTokens,
        CancellationToken cancellationToken = default)
    {
        var messages = new List<object> { new { role = "system", content = systemPrompt } };

        foreach (var turn in history)
        {
            // Anything that is not a recognised role is dropped rather than forwarded: the role
            // field arrives from the client, and "system" from a client would be prompt injection.
            var role = turn.Role?.ToLowerInvariant();
            if (role is not ("user" or "assistant")) continue;

            messages.Add(new { role, content = turn.Content ?? string.Empty });
        }

        var request = new
        {
            model = _settings.Model,
            messages = messages.ToArray(),
            max_tokens = maxOutputTokens,
            temperature = 0.3,
        };

        return SendAsync(request, cancellationToken);
    }

    private async Task<LlmCompletion> SendAsync(object request, CancellationToken cancellationToken)
    {
        if (!IsConfigured)
        {
            throw new FeatureUnavailableException(
                "AI features are not configured on this deployment (no Llm__ApiKey set).");
        }

        using var response = await _http.PostAsJsonAsync("chat/completions", request, SerializerOptions, cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync(cancellationToken);

            // The provider's message can echo the prompt, so it is logged but never surfaced.
            _logger.LogError("LLM provider returned {Status}: {Body}", (int)response.StatusCode, Truncate(body, 500));

            throw new FeatureUnavailableException(
                "The AI service is temporarily unavailable. Please try again in a moment.");
        }

        await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
        using var document = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);

        var root = document.RootElement;

        var content = root.TryGetProperty("choices", out var choices) && choices.GetArrayLength() > 0
            ? choices[0].GetProperty("message").TryGetProperty("content", out var messageContent)
                ? messageContent.GetString() ?? string.Empty
                : string.Empty
            : string.Empty;

        var finishReason = choices.ValueKind == JsonValueKind.Array && choices.GetArrayLength() > 0
            && choices[0].TryGetProperty("finish_reason", out var reason)
                ? reason.GetString()
                : null;

        // A truncated response is usually invalid JSON, which would otherwise surface as a
        // confusing parse error. Naming the real cause makes the token ceiling tunable.
        if (finishReason == "length")
        {
            _logger.LogWarning("LLM response hit the output token ceiling and was truncated.");
        }

        var (promptTokens, completionTokens) = ReadUsage(root);

        return new LlmCompletion(content, promptTokens, completionTokens, _settings.Model);
    }

    private static (int Prompt, int Completion) ReadUsage(JsonElement root)
    {
        if (!root.TryGetProperty("usage", out var usage)) return (0, 0);

        var prompt = usage.TryGetProperty("prompt_tokens", out var p) ? p.GetInt32() : 0;
        var completion = usage.TryGetProperty("completion_tokens", out var c) ? c.GetInt32() : 0;

        return (prompt, completion);
    }

    private static string Truncate(string value, int max) =>
        value.Length <= max ? value : value[..max] + "...";
}
