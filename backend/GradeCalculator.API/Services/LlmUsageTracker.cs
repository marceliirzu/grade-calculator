using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using GradeCalculator.API.Configuration;
using GradeCalculator.API.Data;
using GradeCalculator.API.DTOs.Responses;
using GradeCalculator.API.Models;
using GradeCalculator.API.Services.Interfaces;

namespace GradeCalculator.API.Services;

public interface ILlmUsageTracker
{
    /// <summary>
    /// Throws <see cref="QuotaExceededException"/> if the user has already spent their daily
    /// budget. Call before spending tokens, never after.
    /// </summary>
    Task EnsureWithinQuotaAsync(int userId, CancellationToken cancellationToken = default);

    Task RecordSpendAsync(int? userId, LlmFeature feature, LlmCompletion completion, bool succeeded, CancellationToken cancellationToken = default);

    /// <summary>Records a call that never happened, so the saving is measurable.</summary>
    Task RecordAvoidedAsync(int? userId, LlmFeature feature, string model, int tokensSaved, CancellationToken cancellationToken = default);

    Task<LlmQuotaResponse> GetQuotaAsync(int userId, CancellationToken cancellationToken = default);
}

public sealed class LlmUsageTracker : ILlmUsageTracker
{
    private readonly AppDbContext _db;
    private readonly LlmSettings _settings;
    private readonly ILogger<LlmUsageTracker> _logger;

    public LlmUsageTracker(AppDbContext db, IOptions<LlmSettings> settings, ILogger<LlmUsageTracker> logger)
    {
        _db = db;
        _settings = settings.Value;
        _logger = logger;
    }

    /// <summary>
    /// Quota windows run from midnight UTC rather than a rolling 24 hours. A fixed window is one
    /// indexed SUM; a rolling window needs a scan per request, and the fairness difference is
    /// not worth that cost at this scale.
    /// </summary>
    private static DateTime WindowStart => DateTime.UtcNow.Date;

    public async Task EnsureWithinQuotaAsync(int userId, CancellationToken cancellationToken = default)
    {
        var limit = _settings.DailyTokenLimitPerUser;
        if (limit <= 0) return; // quota disabled

        var spent = await SpentTodayAsync(userId, cancellationToken);

        if (spent >= limit)
        {
            _logger.LogInformation("User {UserId} hit the daily LLM quota ({Spent}/{Limit}).", userId, spent, limit);

            throw new QuotaExceededException(
                "You have reached today's AI usage limit. It resets at midnight UTC — " +
                "syllabus parsing still works without AI in the meantime.");
        }
    }

    public async Task RecordSpendAsync(
        int? userId,
        LlmFeature feature,
        LlmCompletion completion,
        bool succeeded,
        CancellationToken cancellationToken = default)
    {
        _db.LlmUsages.Add(new LlmUsage
        {
            UserId = userId,
            Feature = feature,
            Model = completion.Model,
            PromptTokens = completion.PromptTokens,
            CompletionTokens = completion.CompletionTokens,
            TotalTokens = completion.TotalTokens,
            WasServedFromCache = false,
            TokensSaved = 0,
            Succeeded = succeeded,
            CreatedAt = DateTime.UtcNow,
        });

        await SaveQuietlyAsync(cancellationToken);
    }

    public async Task RecordAvoidedAsync(
        int? userId,
        LlmFeature feature,
        string model,
        int tokensSaved,
        CancellationToken cancellationToken = default)
    {
        _db.LlmUsages.Add(new LlmUsage
        {
            UserId = userId,
            Feature = feature,
            Model = model,
            PromptTokens = 0,
            CompletionTokens = 0,
            TotalTokens = 0,
            WasServedFromCache = true,
            TokensSaved = Math.Max(0, tokensSaved),
            Succeeded = true,
            CreatedAt = DateTime.UtcNow,
        });

        await SaveQuietlyAsync(cancellationToken);
    }

    public async Task<LlmQuotaResponse> GetQuotaAsync(int userId, CancellationToken cancellationToken = default)
    {
        var since = WindowStart;

        var today = await _db.LlmUsages
            .AsNoTracking()
            .Where(u => u.UserId == userId && u.CreatedAt >= since)
            .GroupBy(_ => 1)
            .Select(g => new
            {
                Spent = g.Sum(u => u.TotalTokens),
                Saved = g.Sum(u => u.TokensSaved),
            })
            .FirstOrDefaultAsync(cancellationToken);

        var spent = today?.Spent ?? 0;
        var limit = _settings.DailyTokenLimitPerUser;

        return new LlmQuotaResponse
        {
            TokensUsedToday = spent,
            DailyTokenLimit = limit,
            TokensRemaining = limit <= 0 ? int.MaxValue : Math.Max(0, limit - spent),
            TokensSavedToday = today?.Saved ?? 0,
            LlmConfigured = _settings.IsConfigured,
        };
    }

    private Task<int> SpentTodayAsync(int userId, CancellationToken cancellationToken)
    {
        var since = WindowStart;

        return _db.LlmUsages
            .AsNoTracking()
            .Where(u => u.UserId == userId && u.CreatedAt >= since)
            .SumAsync(u => u.TotalTokens, cancellationToken);
    }

    /// <summary>
    /// Usage accounting must never fail the user's request. The tokens are already spent by the
    /// time this runs; losing the audit row is bad, but turning a successful parse into a 500
    /// because of a bookkeeping write is worse.
    /// </summary>
    private async Task SaveQuietlyAsync(CancellationToken cancellationToken)
    {
        try
        {
            await _db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException ex)
        {
            _logger.LogError(ex, "Failed to persist an LLM usage record; quota accounting may undercount.");
        }
    }
}
