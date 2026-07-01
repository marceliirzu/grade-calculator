using GradeCalculator.API.DTOs.Responses;
using GradeCalculator.API.Models;

namespace GradeCalculator.API.Services.Interfaces;

public interface ISubscriptionService
{
    /// <summary>Creates a Stripe Checkout session for the given plan ("monthly" | "yearly").</summary>
    Task<string> CreateCheckoutSessionAsync(User user, string plan);

    /// <summary>Creates a Stripe billing-portal session so the user can manage/cancel.</summary>
    Task<string> CreatePortalSessionAsync(User user);

    /// <summary>Handles a verified Stripe webhook event and syncs the user's status.</summary>
    Task HandleWebhookEventAsync(string json, string stripeSignature);

    /// <summary>Current access snapshot for the frontend.</summary>
    SubscriptionStatusResponse GetStatus(User user);
}
