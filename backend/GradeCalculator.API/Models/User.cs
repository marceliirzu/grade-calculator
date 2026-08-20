using System.ComponentModel.DataAnnotations;

namespace GradeCalculator.API.Models;

/// <summary>
/// A local mirror of a Clerk user.
///
/// Clerk owns identity: passwords, OAuth links, MFA and sessions never touch this database.
/// This row exists only so grades have a foreign key to hang off, and is created lazily the
/// first time an authenticated request arrives (see <c>ClerkUserProvisioner</c>).
/// </summary>
public class User
{
    public int Id { get; set; }

    /// <summary>
    /// The Clerk user id (the <c>sub</c> claim, e.g. <c>user_2abc...</c>). This is the only
    /// trustworthy join key: email is user-editable in Clerk and can be reassigned.
    /// </summary>
    [MaxLength(255)]
    public string ClerkUserId { get; set; } = string.Empty;

    /// <summary>
    /// Cached from the token for display and support lookups only. Never used to identify the
    /// user — see <see cref="ClerkUserId"/>. May be empty if the token carries no email claim.
    /// </summary>
    [MaxLength(320)]
    public string Email { get; set; } = string.Empty;

    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? LastSeenAt { get; set; }

    // Navigation
    public ICollection<Class> Classes { get; set; } = new List<Class>();
    public ICollection<Semester> Semesters { get; set; } = new List<Semester>();
}
