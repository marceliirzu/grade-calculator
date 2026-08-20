using Microsoft.AspNetCore.Mvc;
using GradeCalculator.API.Auth;
using GradeCalculator.API.DTOs.Responses;
using GradeCalculator.API.Services;

namespace GradeCalculator.API.Controllers;

/// <summary>
/// Account-scoped endpoints. There is no sign-in or sign-up here — Clerk owns all of that.
/// The first call to <c>/api/account/me</c> is what materialises the local user row.
/// </summary>
[Route("api/account")]
public class AccountController : ApiControllerBase
{
    private readonly ICurrentUserAccessor _currentUser;
    private readonly ILlmUsageTracker _usage;

    public AccountController(ICurrentUserAccessor currentUser, ILlmUsageTracker usage)
        : base(currentUser)
    {
        _currentUser = currentUser;
        _usage = usage;
    }

    [HttpGet("me")]
    public async Task<ActionResult<ApiResponse<MeResponse>>> Me(CancellationToken cancellationToken)
    {
        var user = await _currentUser.GetUserAsync(User, cancellationToken);

        return Ok(ApiResponse<MeResponse>.Ok(new MeResponse
        {
            Id = user.Id,
            Email = user.Email,
            Name = user.Name,
            CreatedAt = user.CreatedAt,
        }));
    }

    /// <summary>
    /// Today's AI budget. The UI reads this to disable AI actions before the user hits a wall,
    /// rather than letting them compose a question and then rejecting it.
    /// </summary>
    [HttpGet("llm-quota")]
    public async Task<ActionResult<ApiResponse<LlmQuotaResponse>>> Quota(CancellationToken cancellationToken)
    {
        var userId = await CurrentUserIdAsync(cancellationToken);

        return Ok(ApiResponse<LlmQuotaResponse>.Ok(await _usage.GetQuotaAsync(userId, cancellationToken)));
    }
}
