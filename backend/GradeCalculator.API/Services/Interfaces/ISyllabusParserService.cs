using GradeCalculator.API.DTOs.Responses;

namespace GradeCalculator.API.Services.Interfaces;

public interface ISyllabusParserService
{
    /// <summary>
    /// Parses a syllabus text and extracts class information
    /// </summary>
    Task<SyllabusParseResponse> ParseSyllabusAsync(string syllabusText);
}
