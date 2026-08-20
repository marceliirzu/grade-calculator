using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using GradeCalculator.API.Auth;
using GradeCalculator.API.DTOs.Requests;
using GradeCalculator.API.DTOs.Responses;
using GradeCalculator.API.Services.Interfaces;

namespace GradeCalculator.API.Controllers;

/// <summary>
/// Syllabus parsing. Rate limited on top of the global limiter because this is the one
/// unauthenticated-adjacent endpoint that can reach a paid provider.
/// </summary>
[EnableRateLimiting("llm")]
public class SyllabusController : ApiControllerBase
{
    private readonly ISyllabusParserService _parser;

    public SyllabusController(ICurrentUserAccessor currentUser, ISyllabusParserService parser)
        : base(currentUser)
    {
        _parser = parser;
    }

    [HttpPost("parse")]
    public async Task<ActionResult<ApiResponse<SyllabusParseResponse>>> Parse(
        [FromBody] ParseSyllabusRequest request, CancellationToken cancellationToken)
    {
        var userId = await CurrentUserIdAsync(cancellationToken);

        var result = await _parser.ParseSyllabusAsync(request.SyllabusText, userId, cancellationToken);

        return Ok(ApiResponse<SyllabusParseResponse>.Ok(result));
    }
}
