using GradeCalculator.API.DTOs.Responses;

namespace GradeCalculator.API.Services.Interfaces;

public interface ISyllabusParserService
{
    /// <summary>
    /// Extracts class name, credit hours, grading categories and grade scale from raw syllabus
    /// text, spending as few tokens as possible.
    /// </summary>
    /// <param name="userId">
    /// Null for guest callers. A null user cannot reach the LLM tier — quota is enforced per
    /// user, so an unattributable call would be an unmetered one. Guests still get the
    /// deterministic parser, which handles most syllabi.
    /// </param>
    Task<SyllabusParseResponse> ParseSyllabusAsync(
        string syllabusText,
        int? userId,
        CancellationToken cancellationToken = default);
}
