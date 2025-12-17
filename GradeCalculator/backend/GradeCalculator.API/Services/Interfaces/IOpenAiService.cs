namespace GradeCalculator.API.Services.Interfaces;

public interface IOpenAiService
{
    /// <summary>
    /// Sends a prompt to OpenAI and returns the response
    /// </summary>
    Task<string> GetCompletionAsync(string prompt);
    
    /// <summary>
    /// Sends a prompt to OpenAI and parses the response as JSON
    /// </summary>
    Task<T?> GetCompletionAsJsonAsync<T>(string prompt) where T : class;
}
