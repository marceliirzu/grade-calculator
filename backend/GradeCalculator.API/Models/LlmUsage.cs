using System.ComponentModel.DataAnnotations;

namespace GradeCalculator.API.Models;

public enum LlmFeature
{
    SyllabusParse = 0,
    GradeAdvisor = 1,
}

/// <summary>
/// One row per LLM call attributable to a user. Two jobs:
///
/// 1. Enforcement — the daily per-user token quota is a SUM over this table, so a runaway
///    client cannot spend an unbounded amount of money.
/// 2. Attribution — when the monthly bill moves, this says which feature moved it.
///
/// Rows are also written for calls that were *avoided* (<see cref="WasServedFromCache"/>), with
/// <see cref="TotalTokens"/> zero and <see cref="TokensSaved"/> set, so the saving from the
/// deterministic parser and the cache is measurable rather than assumed.
/// </summary>
public class LlmUsage
{
    public long Id { get; set; }

    /// <summary>Null for unauthenticated/guest-triggered calls, which are quota-limited by IP.</summary>
    public int? UserId { get; set; }

    public LlmFeature Feature { get; set; }

    [MaxLength(60)]
    public string Model { get; set; } = string.Empty;

    public int PromptTokens { get; set; }
    public int CompletionTokens { get; set; }
    public int TotalTokens { get; set; }

    /// <summary>True when no request left the process (deterministic parse or cache hit).</summary>
    public bool WasServedFromCache { get; set; }

    /// <summary>Tokens a cached/deterministic result avoided spending.</summary>
    public int TokensSaved { get; set; }

    /// <summary>False when the provider errored or the response failed validation.</summary>
    public bool Succeeded { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public User? User { get; set; }
}
