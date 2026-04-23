using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using GradeCalculator.API.DTOs.Requests;
using GradeCalculator.API.DTOs.Responses;
using GradeCalculator.API.Services.Interfaces;
using System.Security.Claims;

namespace GradeCalculator.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class GradeAdvisorController : ControllerBase
{
    private readonly IGradeAdvisorService _gradeAdvisor;
    private readonly ITargetGradeCalculatorService _targetCalculator;

    public GradeAdvisorController(
        IGradeAdvisorService gradeAdvisor,
        ITargetGradeCalculatorService targetCalculator)
    {
        _gradeAdvisor = gradeAdvisor;
        _targetCalculator = targetCalculator;
    }

    // POST: api/gradeadvisor/chat
    [HttpPost("chat")]
    public async Task<ActionResult<ApiResponse<ChatResponse>>> Chat(ChatRequest request)
    {
        var userId = GetUserId();
        try
        {
            var response = await _gradeAdvisor.ChatAsync(userId, request);
            return Ok(ApiResponse<ChatResponse>.Ok(response));
        }
        catch (Exception ex)
        {
            return BadRequest(ApiResponse<ChatResponse>.Fail($"Chat failed: {ex.Message}"));
        }
    }

    // GET: api/gradeadvisor/target?classId=1&targetGrade=A
    [HttpGet("target")]
    public async Task<ActionResult<ApiResponse<TargetGradeResult>>> GetTargetGrade(
        [FromQuery] int classId,
        [FromQuery] string targetGrade = "A")
    {
        var userId = GetUserId();
        try
        {
            var result = await _targetCalculator.CalculateTargetAsync(classId, targetGrade, userId);
            return Ok(ApiResponse<TargetGradeResult>.Ok(result));
        }
        catch (InvalidOperationException ex)
        {
            return NotFound(ApiResponse<TargetGradeResult>.Fail(ex.Message));
        }
        catch (Exception ex)
        {
            return BadRequest(ApiResponse<TargetGradeResult>.Fail(ex.Message));
        }
    }

    private int GetUserId() =>
        int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "0");
}
