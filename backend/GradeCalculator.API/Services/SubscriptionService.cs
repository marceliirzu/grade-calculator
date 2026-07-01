using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Stripe;
using Stripe.Checkout;
using Stripe.BillingPortal;
using GradeCalculator.API.Configuration;
using GradeCalculator.API.Data;
using GradeCalculator.API.DTOs.Responses;
using GradeCalculator.API.Models;
using GradeCalculator.API.Services.Interfaces;

namespace GradeCalculator.API.Services;

public class SubscriptionService : ISubscriptionService
{
    private readonly AppDbContext _context;
    private readonly StripeSettings _settings;
    private readonly ILogger<SubscriptionService> _logger;

    public SubscriptionService(
        AppDbContext context,
        IOptions<StripeSettings> settings,
        ILogger<SubscriptionService> logger)
    {
        _context = context;
        _settings = settings.Value;
        _logger = logger;
    }

    public async Task<string> CreateCheckoutSessionAsync(User user, string plan)
    {
        EnsureConfigured();

        var priceId = plan?.ToLowerInvariant() switch
        {
            "yearly" => _settings.YearlyPriceId,
            _ => _settings.MonthlyPriceId
        };

        if (string.IsNullOrWhiteSpace(priceId) || priceId.StartsWith("SET_"))
            throw new InvalidOperationException("Stripe price ID is not configured.");

        var customerId = await GetOrCreateCustomerAsync(user);

        var options = new Stripe.Checkout.SessionCreateOptions
        {
            Mode = "subscription",
            Customer = customerId,
            ClientReferenceId = user.Id.ToString(),
            LineItems = new List<SessionLineItemOptions>
            {
                new() { Price = priceId, Quantity = 1 }
            },
            AllowPromotionCodes = true,
            SuccessUrl = $"{_settings.FrontendUrl.TrimEnd('/')}/?checkout=success",
            CancelUrl = $"{_settings.FrontendUrl.TrimEnd('/')}/?checkout=cancel",
            SubscriptionData = new SessionSubscriptionDataOptions
            {
                Metadata = new Dictionary<string, string> { ["userId"] = user.Id.ToString() }
            }
        };

        var session = await new Stripe.Checkout.SessionService().CreateAsync(options);
        return session.Url;
    }

    public async Task<string> CreatePortalSessionAsync(User user)
    {
        EnsureConfigured();

        if (string.IsNullOrWhiteSpace(user.StripeCustomerId))
            throw new InvalidOperationException("No billing account exists for this user yet.");

        var options = new Stripe.BillingPortal.SessionCreateOptions
        {
            Customer = user.StripeCustomerId,
            ReturnUrl = _settings.FrontendUrl
        };

        var session = await new Stripe.BillingPortal.SessionService().CreateAsync(options);
        return session.Url;
    }

    public async Task HandleWebhookEventAsync(string json, string stripeSignature)
    {
        EnsureConfigured();

        // Throws StripeException on bad signature — controller maps that to 400.
        var stripeEvent = EventUtility.ConstructEvent(json, stripeSignature, _settings.WebhookSecret);

        _logger.LogInformation("Stripe webhook received: {Type}", stripeEvent.Type);

        switch (stripeEvent.Type)
        {
            case "checkout.session.completed":
            {
                if (stripeEvent.Data.Object is Stripe.Checkout.Session session)
                    await SyncFromCheckoutSessionAsync(session);
                break;
            }
            case "customer.subscription.created":
            case "customer.subscription.updated":
            case "customer.subscription.deleted":
            {
                if (stripeEvent.Data.Object is Subscription sub)
                    await SyncFromSubscriptionAsync(sub);
                break;
            }
            case "invoice.payment_failed":
            {
                if (stripeEvent.Data.Object is Invoice invoice && invoice.CustomerId != null)
                {
                    var user = await FindByCustomerAsync(invoice.CustomerId);
                    if (user != null)
                    {
                        user.SubscriptionStatus = "past_due";
                        await _context.SaveChangesAsync();
                    }
                }
                break;
            }
            default:
                _logger.LogDebug("Unhandled Stripe event type: {Type}", stripeEvent.Type);
                break;
        }
    }

    public SubscriptionStatusResponse GetStatus(User user)
    {
        var now = DateTime.UtcNow;
        var trialEnd = user.TrialEndsAt ?? user.CreatedAt.AddDays(_settings.TrialDays);
        var inTrial = user.SubscriptionStatus == "none" && trialEnd > now;

        return new SubscriptionStatusResponse
        {
            HasAccess = user.HasActiveAccess(now),
            Status = inTrial ? "trial" : user.SubscriptionStatus,
            TrialEndsAt = user.SubscriptionStatus == "none" ? trialEnd : null,
            CurrentPeriodEnd = user.SubscriptionCurrentPeriodEnd,
            BillingConfigured = _settings.IsConfigured
        };
    }

    // ---- internals ----

    private void EnsureConfigured()
    {
        if (!_settings.IsConfigured)
            throw new InvalidOperationException(
                "Stripe is not configured. Set Stripe__SecretKey (and related keys) in the environment.");
    }

    private async Task<string> GetOrCreateCustomerAsync(User user)
    {
        if (!string.IsNullOrWhiteSpace(user.StripeCustomerId))
            return user.StripeCustomerId;

        var customer = await new CustomerService().CreateAsync(new CustomerCreateOptions
        {
            Email = user.Email,
            Name = user.Name,
            Metadata = new Dictionary<string, string> { ["userId"] = user.Id.ToString() }
        });

        user.StripeCustomerId = customer.Id;
        await _context.SaveChangesAsync();
        return customer.Id;
    }

    private async Task<User?> FindByCustomerAsync(string customerId) =>
        await _context.Users.FirstOrDefaultAsync(u => u.StripeCustomerId == customerId);

    private async Task SyncFromCheckoutSessionAsync(Stripe.Checkout.Session session)
    {
        User? user = null;

        if (int.TryParse(session.ClientReferenceId, out var userId))
            user = await _context.Users.FindAsync(userId);

        user ??= session.CustomerId != null ? await FindByCustomerAsync(session.CustomerId) : null;

        if (user == null)
        {
            _logger.LogWarning("checkout.session.completed: no matching user (session {Id})", session.Id);
            return;
        }

        user.StripeCustomerId ??= session.CustomerId;
        user.StripeSubscriptionId = session.SubscriptionId;

        if (session.SubscriptionId != null)
        {
            var sub = await new Stripe.SubscriptionService().GetAsync(session.SubscriptionId);
            ApplySubscription(user, sub);
        }
        else
        {
            user.SubscriptionStatus = "active";
        }

        await _context.SaveChangesAsync();
        _logger.LogInformation("Subscription activated for user {Email}", user.Email);
    }

    private async Task SyncFromSubscriptionAsync(Subscription sub)
    {
        var user = await FindByCustomerAsync(sub.CustomerId)
                   ?? (sub.Metadata.TryGetValue("userId", out var idStr) && int.TryParse(idStr, out var id)
                       ? await _context.Users.FindAsync(id)
                       : null);

        if (user == null)
        {
            _logger.LogWarning("Subscription event: no matching user for customer {Customer}", sub.CustomerId);
            return;
        }

        user.StripeCustomerId ??= sub.CustomerId;
        user.StripeSubscriptionId = sub.Id;
        ApplySubscription(user, sub);
        await _context.SaveChangesAsync();
    }

    private static void ApplySubscription(User user, Subscription sub)
    {
        user.SubscriptionStatus = sub.Status switch
        {
            "active" => "active",
            "trialing" => "trialing",
            "past_due" or "unpaid" => "past_due",
            "canceled" or "incomplete_expired" => "canceled",
            _ => user.SubscriptionStatus
        };

        var periodEnd = sub.Items?.Data?.FirstOrDefault()?.CurrentPeriodEnd;
        if (periodEnd.HasValue)
            user.SubscriptionCurrentPeriodEnd = periodEnd.Value;
    }
}
