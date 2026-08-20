using System.Text;
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
/// Three Claude-specific details that differ from the OpenAI client this replaces:
///
/// 1. <b>No temperature.</b> Sampling parameters were removed on Sonnet 5 and are rejected with
///    a 400, so there is no knob to turn down. Consistency comes from a tightly specified
///    system prompt and from the caller validating what comes back.
/// 2. <b>Every request streams.</b> Not for progress — nothing renders token by token — but
///    because a non-streaming call holds one response open for the whole generation and was
///    being killed by the client timeout.
/// 3. <b>No structured outputs.</b> A JSON Schema would let the API enforce the shape rather
///    than merely ask for it, and that was the first implementation. But a new schema carries a
///    one-time compilation cost, every request timed out before it completed, and the schema
///    was therefore never cached — so each retry paid it again. Worth revisiting once the call
///    is comfortably fast; not worth the failure mode now.
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

            // Deliberately NOT using structured outputs here.
            //
            // A JSON Schema looked like the right tool -- the API enforces the shape rather than
            // asking for it -- but a new schema carries a one-time compilation cost on first
            // use. Every request timed out before that finished, so the schema was never cached
            // and each retry paid the cost again: a loop that could not escape itself. The
            // system prompt already specifies the exact shape, and the caller parses
            // defensively and validates the result, so the guarantee was not worth the risk.
            OutputConfig = new OutputConfig { Effort = Effort.Low },

            // Thinking off for this call. Reading a grading table is mechanical extraction, not
            // reasoning, and thinking tokens both count against MaxTokens and add latency to a
            // request that had already proved it could exceed two minutes. The advisor, which
            // does reason about a student's situation, keeps adaptive thinking on.
            Thinking = new ThinkingConfigDisabled(),
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

    /// <summary>
    /// Sends the request as a <b>stream</b> and reassembles the reply.
    ///
    /// Streaming is not about showing progress here — nothing renders token by token. It is
    /// about not dying. A non-streaming call holds one HTTP response open for the entire
    /// generation, and with adaptive thinking a hard syllabus routinely ran past sixty seconds
    /// and was killed by the client timeout. The user then waited a minute to be told "no
    /// grading categories found", which was both wrong and expensive. A streamed response keeps
    /// data flowing, so the connection never idles out.
    /// </summary>
    private async Task<LlmCompletion> SendAsync(
        AnthropicClient client,
        MessageCreateParams parameters,
        CancellationToken cancellationToken)
    {
        var text = new StringBuilder();

        var promptTokens = 0;
        var completionTokens = 0;
        StopReason? stopReason = null;

        var stopwatch = System.Diagnostics.Stopwatch.StartNew();

        try
        {
            await foreach (var streamEvent in client.Messages.CreateStreaming(parameters, cancellationToken))
            {
                // Input usage arrives once, on the opening event.
                if (streamEvent.TryPickStart(out var start))
                {
                    promptTokens = (int)start.Message.Usage.InputTokens;
                    continue;
                }

                // Text arrives in deltas. Thinking blocks stream as their own delta type and are
                // deliberately not collected — only the schema-shaped answer is wanted.
                if (streamEvent.TryPickContentBlockDelta(out var contentDelta))
                {
                    if (contentDelta.Delta.TryPickText(out var textDelta)) text.Append(textDelta.Text);
                    continue;
                }

                // The closing event carries the final output usage and the stop reason.
                if (streamEvent.TryPickDelta(out var messageDelta))
                {
                    completionTokens = (int)messageDelta.Usage.OutputTokens;

                    // Nullable on the wire: guard before the implicit enum conversion, which
                    // rejects null rather than yielding a default.
                    var rawStopReason = messageDelta.Delta.StopReason;
                    if (rawStopReason is not null) stopReason = rawStopReason;
                }
            }
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
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            // Cancellation the caller did not ask for is the client timeout firing.
            _logger.LogError("Claude request exceeded the {Timeout}s timeout.", _settings.TimeoutSeconds);

            throw new FeatureUnavailableException(
                "The AI took too long to read that syllabus. Try pasting just the grading section.");
        }

        // A truncated reply is unusable against a schema, and would otherwise surface as a
        // confusing parse failure rather than a tunable token ceiling.
        if (stopReason == StopReason.MaxTokens)
        {
            _logger.LogWarning(
                "Claude hit the {Max}-token ceiling; the reply is truncated.", parameters.MaxTokens);
        }

        // Safety classifiers can decline with HTTP 200. Returning the empty string here would
        // look like an unexplained blank answer.
        if (stopReason == StopReason.Refusal)
        {
            _logger.LogWarning("Claude declined the request.");

            throw new FeatureUnavailableException(
                "The AI could not process that content. Try pasting just the grading section.");
        }

        _logger.LogInformation(
            "Claude replied in {Elapsed}ms ({Prompt} in, {Completion} out).",
            stopwatch.ElapsedMilliseconds, promptTokens, completionTokens);

        return new LlmCompletion(
            Content: text.ToString(),
            PromptTokens: promptTokens,
            CompletionTokens: completionTokens,
            Model: _settings.Model);
    }


    private AnthropicClient RequireClient() =>
        _client ?? throw new FeatureUnavailableException(
            "AI features are not configured on this deployment (no Llm__ApiKey set).");
}
