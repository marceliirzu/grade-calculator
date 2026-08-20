using System.Net;
using System.Text.Json;
using GradeCalculator.API.DTOs.Responses;
using GradeCalculator.API.Services;

namespace GradeCalculator.API.Middleware;

/// <summary>
/// Converts unhandled exceptions into the standard response envelope.
///
/// Two rules it exists to enforce:
/// 1. A client never sees a stack trace, a connection string, or a provider error message.
///    Those go to the log, correlated by trace id, and the client gets the id instead.
/// 2. Expected domain failures map to real status codes rather than a blanket 500, so the
///    browser client can distinguish "you asked for something that isn't yours" (404) from
///    "the server is broken" (500).
/// </summary>
public class ExceptionHandlingMiddleware
{
    private static readonly JsonSerializerOptions SerializerOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionHandlingMiddleware> _logger;
    private readonly IHostEnvironment _environment;

    public ExceptionHandlingMiddleware(
        RequestDelegate next,
        ILogger<ExceptionHandlingMiddleware> logger,
        IHostEnvironment environment)
    {
        _next = next;
        _logger = logger;
        _environment = environment;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            await HandleAsync(context, ex);
        }
    }

    private async Task HandleAsync(HttpContext context, Exception exception)
    {
        var traceId = context.TraceIdentifier;

        var (status, clientMessage, logAsWarning) = exception switch
        {
            ResourceNotFoundException e =>
                (HttpStatusCode.NotFound, e.Message, true),

            ValidationFailedException e =>
                (HttpStatusCode.BadRequest, e.Message, true),

            QuotaExceededException e =>
                (HttpStatusCode.TooManyRequests, e.Message, true),

            FeatureUnavailableException e =>
                (HttpStatusCode.ServiceUnavailable, e.Message, true),

            UnauthorizedAccessException =>
                (HttpStatusCode.Unauthorized, "Not authenticated.", true),

            OperationCanceledException when context.RequestAborted.IsCancellationRequested =>
                (HttpStatusCode.RequestTimeout, "Request cancelled.", true),

            _ => (HttpStatusCode.InternalServerError,
                  // Deliberately opaque. The detail lives in the log against this trace id.
                  $"Something went wrong. Reference: {traceId}",
                  false),
        };

        if (logAsWarning)
        {
            _logger.LogWarning(exception,
                "Request {Method} {Path} failed with {Status} (trace {TraceId})",
                context.Request.Method, context.Request.Path, (int)status, traceId);
        }
        else
        {
            _logger.LogError(exception,
                "Unhandled exception for {Method} {Path} (trace {TraceId})",
                context.Request.Method, context.Request.Path, traceId);
        }

        if (context.Response.HasStarted)
        {
            // The response is already on the wire; anything written now would corrupt it.
            _logger.LogWarning("Response already started for trace {TraceId}; cannot write error body.", traceId);
            return;
        }

        context.Response.Clear();
        context.Response.StatusCode = (int)status;
        context.Response.ContentType = "application/json";

        // Only ever attach exception detail outside production.
        var message = status == HttpStatusCode.InternalServerError && _environment.IsDevelopment()
            ? $"{clientMessage} — {exception.Message}"
            : clientMessage;

        var payload = ApiResponse<object>.Fail(message);

        await context.Response.WriteAsync(JsonSerializer.Serialize(payload, SerializerOptions));
    }
}
