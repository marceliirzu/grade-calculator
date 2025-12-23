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

Rules:
1. Group assignments into logical categories (Assignments, Quizzes, Exams, Labs, Homework, Projects, Participation, etc.)
2. If categories are already specified in the gradebook, use those
3. If no categories exist, infer them from assignment names (e.g., 'Quiz 1' goes in 'Quizzes', 'Homework 3' goes in 'Homework')
4. Extract points earned and points possible for each item
5. If only percentages are shown, convert to points (use 100 as points possible, calculate points earned)
6. If an assignment has no grade yet (not submitted/graded, shows '-' or blank), set pointsEarned to null
7. If weights are shown, include them. Otherwise estimate based on typical course structures:
   - Exams/Midterms/Finals: 20-40% each
   - Quizzes: 10-20% total
   - Homework/Assignments: 20-30% total
   - Labs: 10-20% total
   - Participation: 5-10%
   - Projects: 15-25%
8. Weights should sum to 100

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
