using GradeCalculator.API.DTOs.Requests;
using GradeCalculator.API.DTOs.Responses;

namespace GradeCalculator.API.Services.Interfaces;

public interface IGradeAdvisorService
{
    Task<ChatResponse> ChatAsync(int userId, ChatRequest request);
}
