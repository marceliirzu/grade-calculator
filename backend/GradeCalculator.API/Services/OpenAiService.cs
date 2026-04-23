using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;
using GradeCalculator.API.Configuration;
using GradeCalculator.API.DTOs.Responses;
using GradeCalculator.API.Services.Interfaces;

namespace GradeCalculator.API.Services;

public class OpenAiService : IOpenAiService
{
    private readonly HttpClient _httpClient;
    private readonly OpenAiSettings _settings;
    private readonly ILogger<OpenAiService> _logger;
    
    public OpenAiService(HttpClient httpClient, IOptions<OpenAiSettings> settings, ILogger<OpenAiService> logger)
    {
        _httpClient = httpClient;
        _settings = settings.Value;
        _logger = logger;
        
        _httpClient.BaseAddress = new Uri("https://api.openai.com/v1/");
        _httpClient.DefaultRequestHeaders.Add("Authorization", $"Bearer {_settings.ApiKey}");
    }
    
    public async Task<string> GetCompletionAsync(string prompt)
    {
        var requestBody = new
        {
            model = _settings.Model,
            messages = new[]
            {
                new { role = "user", content = prompt }
            },
            max_tokens = _settings.MaxTokens,
            temperature = 0.3 // Lower temperature for more consistent parsing
        };
        
        var json = JsonSerializer.Serialize(requestBody);
        var content = new StringContent(json, Encoding.UTF8, "application/json");
        
        try
        {
            var response = await _httpClient.PostAsync("chat/completions", content);
            response.EnsureSuccessStatusCode();
            
            var responseJson = await response.Content.ReadAsStringAsync();
            var responseDoc = JsonDocument.Parse(responseJson);
            
            var messageContent = responseDoc
                .RootElement
                .GetProperty("choices")[0]
                .GetProperty("message")
                .GetProperty("content")
                .GetString();
            
            return messageContent ?? string.Empty;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error calling OpenAI API");
            throw;
        }
    }
    
    public async Task<T?> GetCompletionAsJsonAsync<T>(string prompt) where T : class
    {
        var response = await GetCompletionAsync(prompt);
        
        // Try to extract JSON from the response (in case there's extra text)
        var jsonStart = response.IndexOf('{');
        var jsonEnd = response.LastIndexOf('}');
        
        if (jsonStart >= 0 && jsonEnd > jsonStart)
        {
            var jsonString = response.Substring(jsonStart, jsonEnd - jsonStart + 1);
            
            try
            {
                return JsonSerializer.Deserialize<T>(jsonString, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });
            }
            catch (JsonException ex)
            {
                _logger.LogWarning(ex, "Failed to parse OpenAI response as JSON: {Response}", response);
                return null;
            }
        }
        
        return null;
    }

    public async Task<string> GetCompletionWithToolsAsync(
        string systemPrompt,
        List<ChatMessageDto> history,
        List<ToolDefinition> tools,
        Func<string, string, Task<string>> toolExecutor)
    {
        // Build messages list
        var messages = new List<object>
        {
            new { role = "system", content = systemPrompt }
        };

        foreach (var h in history)
        {
            messages.Add(new { role = h.Role, content = h.Content });
        }

        // Build tools array in OpenAI format
        var toolsArray = tools.Select(t => new
        {
            type = "function",
            function = new
            {
                name = t.Name,
                description = t.Description,
                parameters = t.Parameters
            }
        }).ToList();

        // Agentic loop: keep calling until no tool_calls in response
        for (int iteration = 0; iteration < 10; iteration++)
        {
            var requestBody = new
            {
                model = _settings.Model,
                messages = messages.ToArray(),
                tools = toolsArray.Count > 0 ? (object)toolsArray : null,
                tool_choice = toolsArray.Count > 0 ? "auto" : null,
                temperature = 0.4
            };

            var json = JsonSerializer.Serialize(requestBody, new JsonSerializerOptions
            {
                DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull
            });
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            var response = await _httpClient.PostAsync("chat/completions", content);
            response.EnsureSuccessStatusCode();

            var responseJson = await response.Content.ReadAsStringAsync();
            var responseDoc = JsonDocument.Parse(responseJson);
            var choice = responseDoc.RootElement.GetProperty("choices")[0];
            var message = choice.GetProperty("message");
            var finishReason = choice.GetProperty("finish_reason").GetString();

            // Check for tool calls
            if (message.TryGetProperty("tool_calls", out var toolCalls) && toolCalls.ValueKind == JsonValueKind.Array)
            {
                // Add assistant message with tool_calls to history
                messages.Add(JsonSerializer.Deserialize<object>(message.GetRawText())!);

                // Execute each tool call
                foreach (var toolCall in toolCalls.EnumerateArray())
                {
                    var toolCallId = toolCall.GetProperty("id").GetString()!;
                    var functionName = toolCall.GetProperty("function").GetProperty("name").GetString()!;
                    var functionArgs = toolCall.GetProperty("function").GetProperty("arguments").GetString()!;

                    string toolResult;
                    try
                    {
                        toolResult = await toolExecutor(functionName, functionArgs);
                    }
                    catch (Exception ex)
                    {
                        toolResult = $"Error executing {functionName}: {ex.Message}";
                    }

                    // Add tool result message
                    messages.Add(new
                    {
                        role = "tool",
                        tool_call_id = toolCallId,
                        content = toolResult
                    });
                }
                // Continue loop to get next response
            }
            else
            {
                // Final text response
                return message.GetProperty("content").GetString() ?? string.Empty;
            }
        }

        return "I was unable to complete the analysis. Please try again.";
    }
}
