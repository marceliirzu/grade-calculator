namespace GradeCalculator.API.Configuration;

public class OpenAiSettings
{
    public string ApiKey { get; set; } = string.Empty;
    public string Model { get; set; } = "gpt-4o-mini";
    public int MaxTokens { get; set; } = 2000;
}
