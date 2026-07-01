using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using Stripe;
using System.Security.Claims;
using GradeCalculator.API.Configuration;
using GradeCalculator.API.Data;
using GradeCalculator.API.DTOs.Responses;
using GradeCalculator.API.Services.Interfaces;

namespace GradeCalculator.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PaymentsController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly ISubscriptionService _subscriptions;
    private readonly StripeSettings _settings;
    private readonly ILogger<PaymentsController> _logger;

    public PaymentsController(
        AppDbContext context,
        ISubscriptionService subscriptions,
        IOptions<StripeSettings> settings,
        ILogger<PaymentsController> logger)
    {
        _context = context;
        _subscriptions = subscriptions;
        _settings = settings.Value;
        _logger = logger;
    }

    // GET: api/payments/config — publishable key + plan info for the frontend
    [HttpGet("config")]
    public ActionResult<ApiResponse<object>> GetConfig()
    {
        return Ok(ApiResponse<object>.Ok(new
        {
            publishableKey = _settings.PublishableKey.StartsWith("SET_") ? "" : _settings.PublishableKey,
            trialDays = _settings.TrialDays,
            billingConfigured = _settings.IsConfigured
        }));
    }

    // GET: api/payments/subscription — the logged-in user's access snapshot
    [HttpGet("subscription")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<SubscriptionStatusResponse>>> GetSubscription()
    {
        var user = await _context.Users.FindAsync(GetUserId());
        if (user == null)
            return NotFound(ApiResponse<SubscriptionStatusResponse>.Fail("User not found"));

        return Ok(ApiResponse<SubscriptionStatusResponse>.Ok(_subscriptions.GetStatus(user)));
    }

    // POST: api/payments/checkout — start a Stripe Checkout session
    [HttpPost("checkout")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<CheckoutSessionResponse>>> CreateCheckout(
        [FromBody] CreateCheckoutRequest request)
    {
        var user = await _context.Users.FindAsync(GetUserId());
        if (user == null)
            return NotFound(ApiResponse<CheckoutSessionResponse>.Fail("User not found"));

        try
        {
            var url = await _subscriptions.CreateCheckoutSessionAsync(user, request.Plan);
            return Ok(ApiResponse<CheckoutSessionResponse>.Ok(new CheckoutSessionResponse { Url = url }));
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(ex, "Checkout unavailable");
            return StatusCode(503, ApiResponse<CheckoutSessionResponse>.Fail(
                "Billing is not configured yet. Please try again later."));
        }
    }

    // POST: api/payments/portal — open the Stripe billing portal
    [HttpPost("portal")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<CheckoutSessionResponse>>> CreatePortal()
    {
        var user = await _context.Users.FindAsync(GetUserId());
        if (user == null)
            return NotFound(ApiResponse<CheckoutSessionResponse>.Fail("User not found"));

        try
        {
            var url = await _subscriptions.CreatePortalSessionAsync(user);
            return Ok(ApiResponse<CheckoutSessionResponse>.Ok(new CheckoutSessionResponse { Url = url }));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ApiResponse<CheckoutSessionResponse>.Fail(ex.Message));
        }
    }

    // POST: api/payments/webhook — Stripe events (signature-verified, anonymous)
    [HttpPost("webhook")]
    [AllowAnonymous]
    public async Task<IActionResult> Webhook()
    {
        var json = await new StreamReader(Request.Body).ReadToEndAsync();
        var signature = Request.Headers["Stripe-Signature"].ToString();

        try
        {
            await _subscriptions.HandleWebhookEventAsync(json, signature);
            return Ok();
        }
        catch (StripeException ex)
        {
            _logger.LogWarning(ex, "Invalid Stripe webhook");
            return BadRequest();
        }
    }

    private int GetUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(claim, out var id) ? id : 0;
    }
}

public class CreateCheckoutRequest
{
    /// <summary>"monthly" or "yearly"</summary>
    public string Plan { get; set; } = "monthly";
}

public class CheckoutSessionResponse
{
    public string Url { get; set; } = string.Empty;
}
