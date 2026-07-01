namespace GradeCalculator.API.Configuration;

public class StripeSettings
{
    /// <summary>Stripe secret key (sk_live_... or sk_test_...)</summary>
    public string SecretKey { get; set; } = string.Empty;

    /// <summary>Stripe publishable key (pk_live_... or pk_test_...) — exposed to the frontend.</summary>
    public string PublishableKey { get; set; } = string.Empty;

    /// <summary>Signing secret for the webhook endpoint (whsec_...)</summary>
    public string WebhookSecret { get; set; } = string.Empty;

    /// <summary>Price ID for the monthly plan (price_...)</summary>
    public string MonthlyPriceId { get; set; } = string.Empty;

    /// <summary>Price ID for the yearly plan (price_...)</summary>
    public string YearlyPriceId { get; set; } = string.Empty;

    /// <summary>Days of full access a new account gets before a subscription is required.</summary>
    public int TrialDays { get; set; } = 7;

    /// <summary>Frontend origin used for checkout success/cancel redirects.</summary>
    public string FrontendUrl { get; set; } = "http://localhost:5500";

    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(SecretKey) && !SecretKey.StartsWith("SET_");
}
