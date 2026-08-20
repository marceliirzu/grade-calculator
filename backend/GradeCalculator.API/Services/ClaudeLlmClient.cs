using System.Text.Json;
using Anthropic;
using Anthropic.Exceptions;
using Anthropic.Models.Messages;
using Microsoft.Extensions.Options;
using GradeCalculator.API.Configuration;
using GradeCalculator.API.Services.Interfaces;

namespace GradeCalculator.API.Services;

/// <summary>
/// Claude client, using the official Anthropic SDK.
///
/// Deliberately thin: it owns transport and token accounting and nothing else. Every expensive
/// decision — should we call at all, on how much text — is made upstream in
/// <see cref="SyllabusParserService"/>, which reaches this class only after a deterministic
/// pass and a shared cache have both failed.
///
/// Two Claude-specific details that differ from the OpenAI client this replaces:
///
/// 1. <b>No temperature.</b> Sampling parameters were removed on Sonnet 5 and are rejected with
///    a 400. Determinism comes from the structured-output schema instead, which is a stronger
///    guarantee than asking for low temperature and hoping.
/// 2. <b>Structured outputs, not "JSON mode".</b> A JSON Schema is supplied via
///    <c>OutputConfig.Format</c> and enforced by the API, so a malformed shape cannot come back
///    at all — where OpenAI's json_object mode only promised syntactically valid JSON.
/// </summary>
public sealed class ClaudeLlmClient : ILlmClient
{
    private static readonly JsonSerializerOptions SerializerOptions = new(JsonSerializerDefaults.Web);

    private readonly AnthropicClient? _client;
    private readonly LlmSettings _settings;
    private readonly ILogger<ClaudeLlmClient> _logger;

    public ClaudeLlmClient(IOptions<LlmSettings> settings, ILogger<ClaudeLlmClient> logger)
    {
        _settings = settings.Value;
        _logger = logger;

        // Constructed only when a key exists. The SDK would otherwise fall back to ambient
        // credential discovery, which on a developer machine can silently pick up a personal
        // key and bill it — a deployment with no key configured must simply have no client.
        if (_settings.IsConfigured)
        {
            _client = new AnthropicClient
            {
                ApiKey = _settings.ApiKey,
                Timeout = TimeSpan.FromSeconds(_settings.TimeoutSeconds),
            };
        }
    }

    public bool IsConfigured => _settings.IsConfigured && _client is not null;

    public string Model => _settings.Model;

    public async Task<LlmCompletion> CompleteJsonAsync(
        string systemPrompt,
        string userContent,
        int maxOutputTokens,
        CancellationToken cancellationToken = default)
    {
        var client = RequireClient();

        var parameters = new MessageCreateParams
        {
            Model = _settings.Model,
            MaxTokens = maxOutputTokens,
            System = systemPrompt,
            Messages = [new() { Role = Role.User, Content = userContent }],

            OutputConfig = new OutputConfig
            {
                // Schema-enforced output. The service can deserialize the reply directly
                // instead of hunting for the first '{' in a prose wrapper.
                Format = new JsonOutputFormat { Schema = SyllabusSchema.Value },

                // Extraction from a grading table is mechanical, not a reasoning problem.
                // Low effort keeps latency and spend down; adaptive thinking still lets Claude
                // spend more on a genuinely messy syllabus.
                Effort = Effort.Low,
            },

            Thinking = new ThinkingConfigAdaptive(),
        };

        return await SendAsync(client, parameters, cancellationToken);
    }

    public async Task<LlmCompletion> CompleteChatAsync(
        string systemPrompt,
        IReadOnlyList<DTOs.Responses.ChatMessageDto> history,
        int maxOutputTokens,
        CancellationToken cancellationToken = default)
    {
        var client = RequireClient();

        var messages = new List<MessageParam>();

        foreach (var turn in history)
        {
            // Roles arrive from the client, so anything unrecognised is dropped rather than
            // forwarded — a "system" role from a browser would be prompt injection.
            var role = turn.Role?.ToLowerInvariant() switch
            {
                "user" => Role.User,
                "assistant" => Role.Assistant,
                _ => (Role?)null,
            };

            if (role is null || string.IsNullOrWhiteSpace(turn.Content)) continue;

            messages.Add(new MessageParam { Role = role.Value, Content = turn.Content });
        }

        // The API rejects an empty conversation, and a trailing assistant turn would ask Claude
        // to continue its own message rather than answer.
        if (messages.Count == 0 || messages[^1].Role != Role.User)
        {
            throw new ValidationFailedException("The conversation must end with a question from you.");
        }

        var parameters = new MessageCreateParams
        {
            Model = _settings.Model,
            MaxTokens = maxOutputTokens,
            System = systemPrompt,
            Messages = messages,
            OutputConfig = new OutputConfig { Effort = Effort.Low },
            Thinking = new ThinkingConfigAdaptive(),
        };

        return await SendAsync(client, parameters, cancellationToken);
    }

    private async Task<LlmCompletion> SendAsync(
        AnthropicClient client,
        MessageCreateParams parameters,
        CancellationToken cancellationToken)
    {
        Message response;

        try
        {
            response = await client.Messages.Create(parameters, cancellationToken: cancellationToken);
        }
        catch (AnthropicRateLimitException ex)
        {
            _logger.LogWarning(ex, "Claude rate limit hit.");

            throw new FeatureUnavailableException(
                "The AI service is busy right now. Please try again in a moment.");
        }
        catch (AnthropicApiException ex)
        {
            // The provider message can echo the prompt, so it is logged but never surfaced.
            _logger.LogError(ex, "Claude request failed.");

            throw new FeatureUnavailableException(
                "The AI service is temporarily unavailable. Please try again in a moment.");
        }

        var text = string.Concat(
            response.Content
                .Select(block => block.Value)
                .OfType<TextBlock>()
                .Select(block => block.Text));

        // A truncated reply is usually unusable JSON, which would otherwise surface as a
        // confusing parse failure rather than a tunable token ceiling.
        if (response.StopReason == StopReason.MaxTokens)
        {
            _logger.LogWarning("Claude response hit the output token ceiling and was truncated.");
        }

        // Safety classifiers can decline a request with HTTP 200. Reading Content without
        // checking would yield an empty string and look like an unexplained blank answer.
        if (response.StopReason == StopReason.Refusal)
        {
            _logger.LogWarning("Claude declined the request: {Category}", response.StopDetails?.Category);

            throw new FeatureUnavailableException(
                "The AI could not process that content. Try pasting just the grading section.");
        }

        return new LlmCompletion(
            Content: text,
            PromptTokens: (int)response.Usage.InputTokens,
            CompletionTokens: (int)response.Usage.OutputTokens,
            Model: _settings.Model);
    }

    private AnthropicClient RequireClient() =>
        _client ?? throw new FeatureUnavailableException(
            "AI features are not configured on this deployment (no Llm__ApiKey set).");

    /// <summary>
    /// JSON Schema the syllabus reply must satisfy. Built once — it is constant, and rebuilding
    /// per request would allocate on every parse.
    /// </summary>
    private static class SyllabusSchema
    {
        public static readonly Dictionary<string, JsonElement> Value = Build();

        private static Dictionary<string, JsonElement> Build()
        {
            var scaleProperties = new Dictionary<string, object>();
            foreach (var key in new[]
                     {
                         "aPlus", "a", "aMinus", "bPlus", "b", "bMinus",
                         "cPlus", "c", "cMinus", "dPlus", "d", "dMinus",
                     })
            {
                scaleProperties[key] = new { type = new[] { "number", "null" } };
            }

            var schema = new
            {
                type = "object",
                properties = new
                {
                    className = new { type = new[] { "string", "null" } },
                    creditHours = new { type = new[] { "number", "null" } },
                    categories = new
                    {
                        type = "array",
                        items = new
                        {
                            type = "object",
                            properties = new
                            {
                                name = new { type = "string" },
                                weight = new { type = "number" },
                            },
                            required = new[] { "name", "weight" },
                            additionalProperties = false,
                        },
                    },
                    gradeScale = new
                    {
                        type = new[] { "object", "null" },
                        properties = scaleProperties,
                        additionalProperties = false,
                    },
                },
                required = new[] { "categories" },
                additionalProperties = false,
            };

            var serialized = JsonSerializer.SerializeToElement(schema, SerializerOptions);

            return serialized.EnumerateObject()
                .ToDictionary(property => property.Name, property => property.Value.Clone());
        }
    }
}
