using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Text;
using System.Text.Json;
using GradeCalculator.API.DTOs.Responses;

namespace GradeCalculator.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SyllabusController : ControllerBase
{
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;
    private readonly ILogger<SyllabusController> _logger;

    public SyllabusController(IHttpClientFactory httpClientFactory, IConfiguration configuration, ILogger<SyllabusController> logger)
    {
        _httpClient = httpClientFactory.CreateClient();
        _configuration = configuration;
        _logger = logger;
        
        var apiKey = _configuration["OpenAi:ApiKey"];
        if (!string.IsNullOrEmpty(apiKey))
        {
            _httpClient.DefaultRequestHeaders.Add("Authorization", $"Bearer {apiKey}");
        }
    }

    [HttpPost("parse")]
    public async Task<IActionResult> ParseSyllabus([FromBody] SyllabusParseRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Content))
        {
            return BadRequest(ApiResponse<object>.Fail("No syllabus content provided"));
        }

        try
        {
            var prompt = @"You are a syllabus parser. Extract the grading breakdown from the following syllabus text.

Return a JSON object with this exact structure:
{
    ""className"": ""Course name if found, or empty string"",
    ""categories"": [
        {
            ""name"": ""Category Name"",
            ""weight"": 25
        }
    ]
}

Rules:
1. Extract all grading categories and their weights as percentages
2. Weights should sum to 100 (adjust proportionally if they don't)
3. Common categories: Homework, Quizzes, Exams, Midterm, Final, Participation, Projects, Labs
4. If a category shows points instead of percentage, convert to approximate percentage
5. If no weights are found, estimate typical weights for the category types found

Parse this syllabus:
" + request.Content;

            var openAiRequest = new
            {
                model = "gpt-4o-mini",
                messages = new[]
                {
                    new { role = "system", content = "You are a helpful assistant that parses syllabi and returns structured JSON." },
                    new { role = "user", content = prompt }
                },
                temperature = 0.1,
                max_tokens = 1000
            };

            var jsonContent = JsonSerializer.Serialize(openAiRequest);
            var httpContent = new StringContent(jsonContent, Encoding.UTF8, "application/json");

            var response = await _httpClient.PostAsync("https://api.openai.com/v1/chat/completions", httpContent);
            var responseBody = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogError("OpenAI API error: {Response}", responseBody);
                return StatusCode(500, ApiResponse<object>.Fail("Failed to parse syllabus"));
            }

            using var doc = JsonDocument.Parse(responseBody);
            var content = doc.RootElement
                .GetProperty("choices")[0]
                .GetProperty("message")
                .GetProperty("content")
                .GetString();

            // Clean up the response - remove markdown code blocks if present
            content = content?.Trim();
            if (content?.StartsWith("```") == true)
            {
                content = content.Substring(content.IndexOf('\n') + 1);
                content = content.Substring(0, content.LastIndexOf("```"));
            }

            var parsedData = JsonSerializer.Deserialize<JsonElement>(content!);
            
            return Ok(ApiResponse<object>.Ok(parsedData));
        }
        catch (JsonException ex)
        {
            _logger.LogError(ex, "Failed to parse OpenAI response as JSON");
            return StatusCode(500, ApiResponse<object>.Fail("Failed to parse syllabus data"));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error parsing syllabus");
            return StatusCode(500, ApiResponse<object>.Fail("An error occurred while parsing the syllabus"));
        }
    }

    [HttpPost("parse-gradebook")]
    public async Task<IActionResult> ParseGradebook([FromBody] SyllabusParseRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Content))
        {
            return BadRequest(ApiResponse<object>.Fail("No gradebook content provided"));
        }

        try
        {
            var prompt = @"You are a gradebook parser. Extract grade information from the pasted gradebook data.

Return a JSON object with this exact structure:
{
    ""className"": ""Course name if found, or empty string"",
    ""categories"": [
        {
            ""name"": ""Category Name"",
            ""weight"": 25,
            ""items"": [
                {
                    ""name"": ""Assignment Name"",
                    ""pointsEarned"": 85,
                    ""pointsPossible"": 100
                }
            ]
        }
    ]
}

CRITICAL RULES FOR EXTRA CREDIT:
1. ANY assignment with 'extra credit', 'EC', 'XC', or 'bonus' in the name is EXTRA CREDIT
2. Extra credit items MUST have pointsPossible set to 0 (zero)
3. Extra credit items should be placed in their natural category (e.g., 'Quiz Extra Credit' goes in 'Quizzes')
4. Do NOT create a separate 'Extra Credit' category - put extra credit items in the category they belong to
5. If an extra credit item has no clear category, put it in 'Assignments'

RULES FOR UNGRADED ITEMS:
1. If an assignment shows 'Not graded', '-', 'N/A', blank, or no score: set pointsEarned to null
2. These represent future/ungraded assignments the student can use for 'what-if' calculations

CATEGORY RULES:
1. Group assignments into logical categories based on their names:
   - 'Quiz', 'Test' → Quizzes
   - 'Exam', 'Midterm', 'Final' → Exams  
   - 'Homework', 'HW', 'Assignment' → Homework
   - 'Lab' → Labs
   - 'Project' → Projects
   - 'Participation', 'Attendance' → Participation
2. Use existing category names if the gradebook specifies them
3. Keep category names short and simple

WEIGHT RULES:
1. If weights are shown in the gradebook, use those exact weights
2. If no weights shown, estimate based on typical distributions:
   - Exams/Finals: 30-50%
   - Quizzes: 10-20%
   - Homework/Assignments: 20-30%
   - Labs: 10-20%
   - Participation: 5-10%
   - Projects: 15-25%
3. Weights must sum to 100%

POINTS RULES:
1. Extract exact point values (e.g., '85/100' → pointsEarned: 85, pointsPossible: 100)
2. If only percentage shown (e.g., '85%'), convert to points out of 100
3. Scores above 100% are valid (extra credit on regular assignments)
4. For items like '26/25', this is NOT extra credit - it's a regular item where student earned bonus points

Parse this gradebook:
" + request.Content;

            var openAiRequest = new
            {
                model = "gpt-4o-mini",
                messages = new[]
                {
                    new { role = "system", content = "You are a helpful assistant that parses gradebook data and returns structured JSON." },
                    new { role = "user", content = prompt }
                },
                temperature = 0.1,
                max_tokens = 2000
            };

            var jsonContent = JsonSerializer.Serialize(openAiRequest);
            var httpContent = new StringContent(jsonContent, Encoding.UTF8, "application/json");

            var response = await _httpClient.PostAsync("https://api.openai.com/v1/chat/completions", httpContent);
            var responseBody = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogError("OpenAI API error: {Response}", responseBody);
                return StatusCode(500, ApiResponse<object>.Fail("Failed to parse gradebook"));
            }

            using var doc = JsonDocument.Parse(responseBody);
            var content = doc.RootElement
                .GetProperty("choices")[0]
                .GetProperty("message")
                .GetProperty("content")
                .GetString();

            // Clean up the response - remove markdown code blocks if present
            content = content?.Trim();
            if (content?.StartsWith("```") == true)
            {
                content = content.Substring(content.IndexOf('\n') + 1);
                content = content.Substring(0, content.LastIndexOf("```"));
            }

            var parsedData = JsonSerializer.Deserialize<JsonElement>(content!);
            
            return Ok(ApiResponse<object>.Ok(parsedData));
        }
        catch (JsonException ex)
        {
            _logger.LogError(ex, "Failed to parse OpenAI response as JSON");
            return StatusCode(500, ApiResponse<object>.Fail("Failed to parse gradebook data"));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error parsing gradebook");
            return StatusCode(500, ApiResponse<object>.Fail("An error occurred while parsing the gradebook"));
        }
    }
}

public class SyllabusParseRequest
{
    public string Content { get; set; } = string.Empty;
}

