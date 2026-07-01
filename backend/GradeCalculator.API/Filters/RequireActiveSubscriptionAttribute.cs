using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using System.Security.Claims;
using GradeCalculator.API.Data;
using GradeCalculator.API.DTOs.Responses;

namespace GradeCalculator.API.Filters;

/// <summary>
/// Blocks the request with 402 Payment Required unless the authenticated user
/// has an active subscription or is inside their free trial.
/// Apply to controllers/actions behind the paywall.
/// </summary>
public class RequireActiveSubscriptionAttribute : TypeFilterAttribute
{
    public RequireActiveSubscriptionAttribute() : base(typeof(RequireActiveSubscriptionFilter)) { }

    private class RequireActiveSubscriptionFilter : IAsyncActionFilter
    {
        private readonly AppDbContext _context;

        public RequireActiveSubscriptionFilter(AppDbContext context)
        {
            _context = context;
        }

        public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
        {
            var claim = context.HttpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(claim, out var userId))
            {
                context.Result = new UnauthorizedResult();
                return;
            }

            var user = await _context.Users.FindAsync(userId);
            if (user == null)
            {
                context.Result = new UnauthorizedResult();
                return;
            }

            if (!user.HasActiveAccess(DateTime.UtcNow))
            {
                context.Result = new ObjectResult(
                    ApiResponse<object>.Fail("subscription_required"))
                {
                    StatusCode = StatusCodes.Status402PaymentRequired
                };
                return;
            }

            await next();
        }
    }
}
