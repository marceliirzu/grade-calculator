using Microsoft.AspNetCore.Mvc;
using GradeCalculator.API.DTOs.Requests;
using GradeCalculator.API.DTOs.Responses;
using GradeCalculator.API.Services.Interfaces;

namespace GradeCalculator.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SyllabusController : ControllerBase
{
    private readonly ISyllabusParserService _syllabusParser;
    
    public SyllabusController(ISyllabusParserService syllabusParser)
    {
        _syllabusParser = syllabusParser;
    }
    
    // POST: api/syllabus/parse
    [HttpPost("parse")]
    public async Task<ActionResult<ApiResponse<SyllabusParseResponse>>> ParseSyllabus(ParseSyllabusRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.SyllabusText))
            return BadRequest(ApiResponse<SyllabusParseResponse>.Fail("Syllabus text is required"));
        
        // Limit input size to prevent abuse
        if (request.SyllabusText.Length > 50000)
            return BadRequest(ApiResponse<SyllabusParseResponse>.Fail("Syllabus text too long (max 50,000 characters)"));
        
        var result = await _syllabusParser.ParseSyllabusAsync(request.SyllabusText);
        
        return Ok(ApiResponse<SyllabusParseResponse>.Ok(result));
    }
}
