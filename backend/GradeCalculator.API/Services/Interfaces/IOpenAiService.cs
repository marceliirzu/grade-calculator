using GradeCalculator.API.DTOs.Responses;

namespace GradeCalculator.API.Services.Interfaces;

public class ToolDefinition
{
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public object Parameters { get; set; } = new { };
}

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

    /// <summary>
    /// Runs a multi-turn conversation with OpenAI function calling (tools).
    /// Loops until the model returns a final text response with no tool calls.
    /// </summary>
    Task<string> GetCompletionWithToolsAsync(
        string systemPrompt,
        List<ChatMessageDto> history,
        List<ToolDefinition> tools,
        Func<string, string, Task<string>> toolExecutor);
}
