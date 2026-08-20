using System.ComponentModel.DataAnnotations;

namespace GradeCalculator.API.Models;

/// <summary>
/// A previously-computed syllabus parse, keyed by a hash of the normalised syllabus text.
///
/// This is the single largest token saving in the app. Students in the same course upload
/// byte-identical syllabi, and the same student re-parses the same document after a failed
/// edit; both are served from here for zero tokens.
///
/// Only the *extracted structure* is stored, never the syllabus text itself. The hash is a
/// one-way digest, so a cache entry cannot be used to recover the document it came from — which
/// is what makes a cross-user cache acceptable.
/// </summary>
public class SyllabusParseCache
{
    public int Id { get; set; }

    /// <summary>
    /// Lowercase hex SHA-256 of the normalised text. Normalisation (whitespace collapsing, case
    /// folding) happens before hashing so that cosmetically different copies of the same
    /// syllabus still collide, which is the entire point.
    /// </summary>
    [MaxLength(64)]
    public string ContentHash { get; set; } = string.Empty;

    /// <summary>Serialised <c>SyllabusParseResponse</c>.</summary>
    public string ResultJson { get; set; } = string.Empty;

    /// <summary>Which path produced this: "deterministic" or "llm".</summary>
    [MaxLength(20)]
    public string Source { get; set; } = string.Empty;

    /// <summary>Model that produced it, so a model upgrade can invalidate stale entries.</summary>
    [MaxLength(60)]
    public string? Model { get; set; }

    /// <summary>Tokens this entry cost to create — every subsequent hit saves exactly this many.</summary>
    public int TokensSpent { get; set; }

    public int HitCount { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime LastHitAt { get; set; } = DateTime.UtcNow;
}
