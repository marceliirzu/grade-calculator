using System.Text;
using Microsoft.Extensions.Options;
using GradeCalculator.API.Configuration;
using GradeCalculator.API.DTOs.Requests;
using GradeCalculator.API.DTOs.Responses;
using GradeCalculator.API.Models;
using GradeCalculator.API.Services.Interfaces;

namespace GradeCalculator.API.Services;

/// <summary>
/// Answers questions about the student's own grades.
///
/// The previous implementation gave the model a set of tools and let it loop — up to ten
/// round trips per question, each resending the full transcript. That is the most expensive
/// possible shape for a question whose entire answer space is one student's gradebook.
///
/// This version inverts it: the server computes the facts first (using the same grading engine
/// that renders the UI, so the numbers always agree), packs them into a compact snapshot, and
/// makes exactly **one** call. Cost per question is bounded and predictable, latency is a single
/// round trip, and the model cannot invent a grade because the arithmetic never leaves C#.
/// </summary>
public sealed class GradeAdvisorService : IGradeAdvisorService
{
    private const string SystemPrompt =
        """
        You are a study advisor inside a GPA tracking app. You are given a factual snapshot of
        one student's current grades, already computed by the application.

        Rules:
        - Treat the snapshot as the only source of truth about their grades.
        - NEVER recompute, re-derive, or contradict a number in the snapshot. If a figure is not
          there, say you do not have it rather than estimating.
        - Percentages already account for drop-lowest and similar rules.
        - Be concise and concrete: name specific classes and assignments.
        - Be honest when a target is out of reach; do not offer false reassurance.
        - Two or three short paragraphs at most. No markdown headings.
        """;

    private readonly IGradeReadService _grades;
    private readonly ILlmClient _llm;
    private readonly ILlmUsageTracker _usage;
    private readonly LlmSettings _settings;
    private readonly ILogger<GradeAdvisorService> _logger;

    public GradeAdvisorService(
        IGradeReadService grades,
        ILlmClient llm,
        ILlmUsageTracker usage,
        IOptions<LlmSettings> settings,
        ILogger<GradeAdvisorService> logger)
    {
        _grades = grades;
        _llm = llm;
        _usage = usage;
        _settings = settings.Value;
        _logger = logger;
    }

    public async Task<ChatResponse> AskAsync(
        ChatRequest request,
        int userId,
        CancellationToken cancellationToken = default)
    {
        if (!_llm.IsConfigured)
        {
            throw new FeatureUnavailableException(
                "The grade advisor is not available on this deployment (no AI key configured).");
        }

        await _usage.EnsureWithinQuotaAsync(userId, cancellationToken);

        var snapshot = await BuildSnapshotAsync(userId, request.SemesterId, cancellationToken);

        // Only the most recent turns are resent. History is quadratic in cost — every turn
        // repays for every previous turn — so an unbounded transcript is an unbounded bill.
        var history = TrimHistory(request.History);

        history.Add(new ChatMessageDto { Role = "user", Content = request.Message });

        var systemWithFacts = SystemPrompt + "\n\nCURRENT GRADES:\n" + snapshot;

        var completion = await _llm.CompleteChatAsync(
            systemWithFacts, history, _settings.MaxAdvisorOutputTokens, cancellationToken);

        await _usage.RecordSpendAsync(userId, LlmFeature.GradeAdvisor, completion, succeeded: true, cancellationToken);

        var reply = string.IsNullOrWhiteSpace(completion.Content)
            ? "I could not produce an answer for that. Try rephrasing the question."
            : completion.Content.Trim();

        history.Add(new ChatMessageDto { Role = "assistant", Content = reply });

        _logger.LogInformation(
            "Grade advisor answered for user {UserId} using {Tokens} tokens.", userId, completion.TotalTokens);

        return new ChatResponse
        {
            Message = reply,
            UpdatedHistory = history,
            TokensUsed = completion.TotalTokens,
        };
    }

    private List<ChatMessageDto> TrimHistory(IEnumerable<ChatMessageDto>? history)
    {
        if (history is null) return new List<ChatMessageDto>();

        var valid = history
            .Where(m => m.Role is "user" or "assistant" && !string.IsNullOrWhiteSpace(m.Content))
            .ToList();

        var maxMessages = Math.Max(0, _settings.MaxHistoryTurns) * 2; // a turn is user + assistant

        return valid.Count <= maxMessages
            ? valid
            : valid.Skip(valid.Count - maxMessages).ToList();
    }

    /// <summary>
    /// A compact plain-text view of the student's grades.
    ///
    /// Format is chosen for token economy: no JSON braces or repeated key names, one line per
    /// entity, numbers already rounded. This is roughly a third the size of the equivalent JSON
    /// and reads just as unambiguously to a model.
    /// </summary>
    private async Task<string> BuildSnapshotAsync(int userId, int? semesterId, CancellationToken cancellationToken)
    {
        var classes = await _grades.GetClassesAsync(userId, semesterId, cancellationToken);
        var gpa = await _grades.GetGpaAsync(userId, semesterId, cancellationToken);

        if (classes.Count == 0) return "The student has not added any classes yet.";

        var builder = new StringBuilder();

        builder.Append("GPA: ").Append(gpa.OverallGpa?.ToString("0.00") ?? "not enough graded work yet")
               .Append(" across ").Append(gpa.TotalCreditHours).AppendLine(" credit hours.");

        foreach (var cls in classes)
        {
            builder.Append("\nCLASS ").Append(cls.Name)
                   .Append(" (").Append(cls.CreditHours).Append(" cr): ");

            builder.Append(cls.CurrentGrade is null
                ? "no graded work yet"
                : $"{cls.CurrentGrade}% = {cls.LetterGrade}, GPA {cls.Gpa:0.00}");

            builder.AppendLine();

            foreach (var category in cls.Categories)
            {
                builder.Append("  - ").Append(category.Name)
                       .Append(" [").Append(category.Weight).Append("% of grade]: ");

                builder.Append(category.CurrentGrade is null
                    ? "ungraded"
                    : $"{category.CurrentGrade}%");

                var graded = category.GradeItems.Count(i => i.PointsEarned is not null);
                var pending = category.GradeItems.Count - graded;

                builder.Append(" (").Append(graded).Append(" graded");
                if (pending > 0) builder.Append(", ").Append(pending).Append(" pending");
                builder.Append(')');

                // Drop rules change which scores count, so state it rather than letting the
                // model try to reconcile an average that looks wrong.
                if (category.CountedItemCount > 0 && category.CountedItemCount < graded)
                    builder.Append(" — best ").Append(category.CountedItemCount).Append(" count");

                builder.AppendLine();
            }
        }

        return builder.ToString();
    }
}
