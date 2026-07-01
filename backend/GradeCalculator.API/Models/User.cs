namespace GradeCalculator.API.Models;

public class User
{
    public int Id { get; set; }
    public string GoogleId { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? LastLoginAt { get; set; }

    // ---- Billing / subscription (Stripe) ----
    public string? StripeCustomerId { get; set; }
    public string? StripeSubscriptionId { get; set; }

    /// <summary>none | trialing | active | past_due | canceled</summary>
    public string SubscriptionStatus { get; set; } = "none";

    /// <summary>End of the current paid period (access remains until then even if canceled).</summary>
    public DateTime? SubscriptionCurrentPeriodEnd { get; set; }

    /// <summary>End of the no-card free trial granted at signup.</summary>
    public DateTime? TrialEndsAt { get; set; }

    /// <summary>True if the user currently has full access (paid or in trial).</summary>
    public bool HasActiveAccess(DateTime utcNow)
    {
        if (SubscriptionStatus is "active" or "trialing" or "past_due")
        {
            // past_due keeps access until the period actually ends
            if (SubscriptionStatus == "past_due")
                return SubscriptionCurrentPeriodEnd == null || SubscriptionCurrentPeriodEnd > utcNow;
            return true;
        }

        if (SubscriptionStatus == "canceled" && SubscriptionCurrentPeriodEnd > utcNow)
            return true;

        var trialEnd = TrialEndsAt ?? CreatedAt.AddDays(7);
        return trialEnd > utcNow;
    }

    // Navigation
    public ICollection<Class> Classes { get; set; } = new List<Class>();
    public ICollection<Semester> Semesters { get; set; } = new List<Semester>();
}
