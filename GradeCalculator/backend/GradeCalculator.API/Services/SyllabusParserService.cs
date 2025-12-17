using System.Text.Json;
using GradeCalculator.API.DTOs.Responses;
using GradeCalculator.API.Services.Interfaces;

namespace GradeCalculator.API.Services;

public class SyllabusParserService : ISyllabusParserService
{
    private readonly IOpenAiService _openAiService;
    private readonly ILogger<SyllabusParserService> _logger;
    
    public SyllabusParserService(IOpenAiService openAiService, ILogger<SyllabusParserService> logger)
    {
        _openAiService = openAiService;
        _logger = logger;
    }
    
    public async Task<SyllabusParseResponse> ParseSyllabusAsync(string syllabusText)
    {
        var prompt = @"You are analyzing a course syllabus to extract grading information. 

IMPORTANT: Syllabi may show grading in different formats:
- Percentages (e.g., ""Homework: 25%"")
- Points (e.g., ""Homework: 200 points, Exams: 300 points"")
- Mixed formats

YOUR JOB: Always convert everything to PERCENTAGE WEIGHTS that add up to 100%.

For POINT-BASED syllabi:
- Calculate the total points
- Convert each category to a percentage of the total
- Example: If Homework=200pts, Exams=300pts, Total=500pts -> Homework=40%, Exams=60%

Extract the following and return as JSON:
{
    ""className"": ""The course name/title (e.g., 'MATH 101 - Calculus I')"",
    ""creditHours"": 3,
    ""categories"": [
        { ""name"": ""Category Name"", ""weight"": 25 }
    ],
    ""gradeScale"": {
        ""aPlus"": 97, ""a"": 93, ""aMinus"": 90,
        ""bPlus"": 87, ""b"": 83, ""bMinus"": 80,
        ""cPlus"": 77, ""c"": 73, ""cMinus"": 70,
        ""dPlus"": 67, ""d"": 63, ""dMinus"": 60
    }
}

RULES:
1. Category weights MUST add up to exactly 100
2. If points are given, convert to percentages
3. If no grade scale is found, use standard scale shown above
4. If no credit hours found, default to 3
5. Combine similar categories (e.g., ""Exam 1"" and ""Exam 2"" -> ""Exams"")
6. Common category names: Homework, Assignments, Quizzes, Exams, Midterm, Final, Projects, Participation, Labs

SYLLABUS TEXT:
" + syllabusText + @"

Return ONLY valid JSON, no explanation.";

        try
        {
            var response = await _openAiService.GetCompletionAsync(prompt);
            
            _logger.LogInformation("OpenAI Response: {Response}", response);
            
            // Clean up the response - remove markdown code blocks if present
            response = response.Trim();
            if (response.StartsWith("```json"))
            {
                response = response.Substring(7);
            }
            if (response.StartsWith("```"))
            {
                response = response.Substring(3);
            }
            if (response.EndsWith("```"))
            {
                response = response.Substring(0, response.Length - 3);
            }
            response = response.Trim();
            
            var options = new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            };
            
            var parsed = JsonSerializer.Deserialize<AiParsedSyllabus>(response, options);
            
            if (parsed == null)
            {
                throw new Exception("Failed to parse AI response");
            }
            
            // Convert to SyllabusParseResponse
            var result = new SyllabusParseResponse
            {
                ClassName = parsed.ClassName,
                CreditHours = parsed.CreditHours,
                Categories = parsed.Categories?.Select(c => new ParsedCategory
                {
                    Name = c.Name,
                    Weight = c.Weight
                }).ToList() ?? new List<ParsedCategory>(),
                GradeScale = parsed.GradeScale != null ? new ParsedGradeScale
                {
                    APlus = parsed.GradeScale.APlus,
                    A = parsed.GradeScale.A,
                    AMinus = parsed.GradeScale.AMinus,
                    BPlus = parsed.GradeScale.BPlus,
                    B = parsed.GradeScale.B,
                    BMinus = parsed.GradeScale.BMinus,
                    CPlus = parsed.GradeScale.CPlus,
                    C = parsed.GradeScale.C,
                    CMinus = parsed.GradeScale.CMinus,
                    DPlus = parsed.GradeScale.DPlus,
                    D = parsed.GradeScale.D,
                    DMinus = parsed.GradeScale.DMinus
                } : null
            };
            
            // Validate and normalize weights to ensure they add up to 100
            if (result.Categories != null && result.Categories.Count > 0)
            {
                var totalWeight = result.Categories.Sum(c => c.Weight);
                if (Math.Abs(totalWeight - 100) > 0.5m)
                {
                    // Normalize weights to add up to 100
                    var factor = 100m / totalWeight;
                    foreach (var cat in result.Categories)
                    {
                        cat.Weight = Math.Round(cat.Weight * factor, 1);
                    }
                    
                    // Adjust last category to ensure exactly 100
                    var adjustedTotal = result.Categories.Sum(c => c.Weight);
                    if (adjustedTotal != 100)
                    {
                        result.Categories.Last().Weight += (100 - adjustedTotal);
                    }
                }
            }
            
            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to parse syllabus");
            throw;
        }
    }
    
    // Internal class for deserializing AI response
    private class AiParsedSyllabus
    {
        public string? ClassName { get; set; }
        public int? CreditHours { get; set; }
        public List<AiParsedCategory>? Categories { get; set; }
        public AiParsedGradeScale? GradeScale { get; set; }
    }
    
    private class AiParsedCategory
    {
        public string Name { get; set; } = "";
        public decimal Weight { get; set; }
    }
    
    private class AiParsedGradeScale
    {
        public decimal APlus { get; set; } = 97;
        public decimal A { get; set; } = 93;
        public decimal AMinus { get; set; } = 90;
        public decimal BPlus { get; set; } = 87;
        public decimal B { get; set; } = 83;
        public decimal BMinus { get; set; } = 80;
        public decimal CPlus { get; set; } = 77;
        public decimal C { get; set; } = 73;
        public decimal CMinus { get; set; } = 70;
        public decimal DPlus { get; set; } = 67;
        public decimal D { get; set; } = 63;
        public decimal DMinus { get; set; } = 60;
    }
}
