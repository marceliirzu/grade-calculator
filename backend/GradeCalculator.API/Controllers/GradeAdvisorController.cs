using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using GradeCalculator.API.Auth;
using GradeCalculator.API.DTOs.Requests;
using GradeCalculator.API.DTOs.Responses;
using GradeCalculator.API.Services.Interfaces;

namespace GradeCalculator.API.Controllers;

[Route("api/grade-advisor")]
[EnableRateLimiting("llm")]
public class GradeAdvisorController : ApiControllerBase
{
    private readonly IGradeAdvisorService _advisor;

    public GradeAdvisorController(ICurrentUserAccessor currentUser, IGradeAdvisorService advisor)
        : base(currentUser)
    {
        _advisor = advisor;
    }

    [HttpPost("chat")]
    public async Task<ActionResult<ApiResponse<ChatResponse>>> Chat(
        [FromBody] ChatRequest request, CancellationToken cancellationToken)
    {
        var userId = await CurrentUserIdAsync(cancellationToken);

        return Ok(ApiResponse<ChatResponse>.Ok(await _advisor.AskAsync(request, userId, cancellationToken)));
    }
}
