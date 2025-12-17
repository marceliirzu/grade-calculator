using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;
using GradeCalculator.API.Configuration;
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
}
