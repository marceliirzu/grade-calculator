namespace GradeCalculator.API.Auth;

/// <summary>
/// Configuration for verifying Clerk-issued session tokens.
/// Bound from the <c>Clerk</c> configuration section / <c>Clerk__*</c> environment variables.
/// </summary>
public sealed class ClerkSettings
{
    public const string SectionName = "Clerk";

    /// <summary>
    /// The Clerk Frontend API origin, which is also the JWT issuer — for example
    /// <c>https://verb-noun-00.clerk.accounts.dev</c> in development, or
    /// <c>https://clerk.yourdomain.com</c> once a production instance is attached to a domain.
    ///
    /// This drives OIDC discovery, so the signing keys are fetched and rotated automatically;
    /// no key material is ever stored in this repo or in Railway.
    /// </summary>
    public string Authority { get; set; } = string.Empty;

    /// <summary>
    /// Origins permitted to present a token, checked against the <c>azp</c> claim.
    ///
    /// This matters more than it looks. Clerk session tokens carry no <c>aud</c>, so audience
    /// validation is off; <c>azp</c> is what stops a token minted for some other site that
    /// shares this Clerk instance from being replayed against this API. Leaving it empty
    /// disables the check, which is only acceptable in local development.
    /// </summary>
    public IList<string> AuthorizedParties { get; set; } = new List<string>();

    /// <summary>
    /// Tolerance for clock drift. Clerk session tokens are short-lived (about a minute) and the
    /// frontend SDK refreshes them continuously, so the framework default of five minutes would
    /// keep a revoked token usable for far longer than it should be.
    /// </summary>
    public int ClockSkewSeconds { get; set; } = 30;

    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(Authority) && !Authority.StartsWith("SET_", StringComparison.Ordinal);
}
