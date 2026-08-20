using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using GradeCalculator.API.Data;
using GradeCalculator.API.Models;

namespace GradeCalculator.API.Auth;

/// <summary>
/// Resolves the local <see cref="User"/> row for the Clerk identity on the current request,
/// creating it on first sight.
///
/// Clerk owns the account; this database only needs a row to hang foreign keys off. Provisioning
/// lazily on first authenticated request means there is no webhook to miss, no backfill job, and
/// no window where a signed-in user has no home for their data.
/// </summary>
public interface ICurrentUserAccessor
{
    /// <summary>
    /// The local user id for the caller, provisioning the row if this is their first request.
    /// </summary>
    Task<int> GetUserIdAsync(ClaimsPrincipal principal, CancellationToken cancellationToken = default);

    Task<User> GetUserAsync(ClaimsPrincipal principal, CancellationToken cancellationToken = default);
}

public sealed class CurrentUserAccessor : ICurrentUserAccessor
{
    /// <summary>Refresh the cached profile at most this often, to avoid a write per request.</summary>
    private static readonly TimeSpan ProfileRefreshInterval = TimeSpan.FromHours(12);

    private readonly AppDbContext _db;
    private readonly ILogger<CurrentUserAccessor> _logger;

    public CurrentUserAccessor(AppDbContext db, ILogger<CurrentUserAccessor> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task<int> GetUserIdAsync(ClaimsPrincipal principal, CancellationToken cancellationToken = default)
        => (await GetUserAsync(principal, cancellationToken)).Id;

    public async Task<User> GetUserAsync(ClaimsPrincipal principal, CancellationToken cancellationToken = default)
    {
        var clerkUserId = GetClerkUserId(principal)
            ?? throw new UnauthorizedAccessException("Token carries no subject claim.");

        var user = await _db.Users.FirstOrDefaultAsync(u => u.ClerkUserId == clerkUserId, cancellationToken);

        if (user is null)
        {
            user = new User
            {
                ClerkUserId = clerkUserId,
                Email = GetEmail(principal) ?? string.Empty,
                Name = GetName(principal) ?? string.Empty,
                CreatedAt = DateTime.UtcNow,
                LastSeenAt = DateTime.UtcNow,
            };

            _db.Users.Add(user);

            try
            {
                await _db.SaveChangesAsync(cancellationToken);
                _logger.LogInformation("Provisioned local user {UserId} for Clerk subject.", user.Id);
            }
            catch (DbUpdateException)
            {
                // Two concurrent first requests (the SPA fires several calls on load) race to
                // insert the same user. The unique index on ClerkUserId means one loses; that
                // one re-reads the winner's row rather than failing the request.
                _db.Entry(user).State = EntityState.Detached;

                var winner = await _db.Users
                    .FirstOrDefaultAsync(u => u.ClerkUserId == clerkUserId, cancellationToken);

                // No winner means the insert failed for some reason other than the race, so the
                // original exception is the honest thing to surface.
                if (winner is null) throw;

                user = winner;
            }

            return user;
        }

        await RefreshProfileIfStaleAsync(user, principal, cancellationToken);
        return user;
    }

    private async Task RefreshProfileIfStaleAsync(User user, ClaimsPrincipal principal, CancellationToken cancellationToken)
    {
        if (user.LastSeenAt is { } seen && DateTime.UtcNow - seen < ProfileRefreshInterval) return;

        var email = GetEmail(principal);
        var name = GetName(principal);

        user.LastSeenAt = DateTime.UtcNow;
        if (!string.IsNullOrWhiteSpace(email)) user.Email = email;
        if (!string.IsNullOrWhiteSpace(name)) user.Name = name;

        try
        {
            await _db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException ex)
        {
            // A failed last-seen touch must never fail the user's actual request.
            _logger.LogWarning(ex, "Could not refresh cached profile for user {UserId}.", user.Id);
        }
    }

    private static string? GetClerkUserId(ClaimsPrincipal principal) =>
        Coalesce(principal, ClaimTypes.NameIdentifier, "sub");

    private static string? GetEmail(ClaimsPrincipal principal) =>
        Coalesce(principal, ClaimTypes.Email, "email", "email_address", "primary_email_address");

    private static string? GetName(ClaimsPrincipal principal)
    {
        var full = Coalesce(principal, "name", "full_name", ClaimTypes.Name);
        if (!string.IsNullOrWhiteSpace(full)) return full;

        // Clerk can be configured to emit given/family name separately instead of a combined
        // claim, so fall back to stitching them rather than showing a blank name.
        var first = Coalesce(principal, "given_name", "first_name");
        var last = Coalesce(principal, "family_name", "last_name");
        var stitched = string.Join(' ', new[] { first, last }.Where(s => !string.IsNullOrWhiteSpace(s)));

        return string.IsNullOrWhiteSpace(stitched) ? null : stitched;
    }

    private static string? Coalesce(ClaimsPrincipal principal, params string[] claimTypes)
    {
        foreach (var type in claimTypes)
        {
            var value = principal.FindFirstValue(type);
            if (!string.IsNullOrWhiteSpace(value)) return value;
        }

        return null;
    }
}
