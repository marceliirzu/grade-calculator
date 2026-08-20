using GradeCalculator.API.DTOs.Requests;
using GradeCalculator.API.DTOs.Responses;

namespace GradeCalculator.API.Services.Interfaces;

public interface IGradeAdvisorService
{
    /// <summary>
    /// Answers one question about the student's own grades in a single LLM call.
    /// Requires a real account: the snapshot is built from server-side data, and the call is
    /// metered against the user's daily token quota.
    /// </summary>
    Task<ChatResponse> AskAsync(ChatRequest request, int userId, CancellationToken cancellationToken = default);
}
