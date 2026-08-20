using System.Security.Claims;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.IdentityModel.Tokens;
using Serilog;
using GradeCalculator.API.Auth;
using GradeCalculator.API.Configuration;
using GradeCalculator.API.Data;
using GradeCalculator.API.Middleware;
using GradeCalculator.API.Services;
using GradeCalculator.API.Services.Interfaces;

var builder = WebApplication.CreateBuilder(args);

// ---------------------------------------------------------------------------
// Logging. Structured from the first line so startup failures are diagnosable
// in Railway's log viewer rather than appearing as a bare stack trace.
// ---------------------------------------------------------------------------
builder.Host.UseSerilog((context, services, configuration) => configuration
    .ReadFrom.Configuration(context.Configuration)
    .ReadFrom.Services(services)
    .Enrich.FromLogContext()
    .WriteTo.Console());

// ---------------------------------------------------------------------------
// Configuration binding
// ---------------------------------------------------------------------------
builder.Services.Configure<ClerkSettings>(builder.Configuration.GetSection(ClerkSettings.SectionName));
builder.Services.Configure<LlmSettings>(builder.Configuration.GetSection(LlmSettings.SectionName));

var clerkSettings = builder.Configuration.GetSection(ClerkSettings.SectionName).Get<ClerkSettings>()
                    ?? new ClerkSettings();

// Fail fast rather than booting an API that accepts no one. In development the app is allowed
// to run unauthenticated so the guest-mode UI can still be worked on without a Clerk instance.
if (!builder.Environment.IsDevelopment() && !clerkSettings.IsConfigured)
{
    throw new InvalidOperationException(
        "Clerk__Authority is not configured. Set it to your Clerk Frontend API origin " +
        "(e.g. https://clerk.yourdomain.com). Without it no request could ever authenticate.");
}

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------
var connectionString = DatabaseConfiguration.Resolve(builder.Configuration);

builder.Services.AddDbContext<AppDbContext>(options =>
{
    options.UseMySql(
        connectionString,
        ServerVersion.AutoDetect(connectionString),
        mySql => mySql
            .EnableRetryOnFailure(maxRetryCount: 5, maxRetryDelay: TimeSpan.FromSeconds(10), errorNumbersToAdd: null)
            .MigrationsAssembly(typeof(AppDbContext).Assembly.FullName));

    if (builder.Environment.IsDevelopment())
    {
        options.EnableDetailedErrors();
        // Deliberately NOT EnableSensitiveDataLogging: parameter values here are student grades.
    }
});

// ---------------------------------------------------------------------------
// Authentication — Clerk-issued JWTs, verified against Clerk's rotating JWKS.
// ---------------------------------------------------------------------------
builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        // Left unset when Clerk is not configured, which only happens in development. The
        // handler then has no signing keys and rejects every token, so the API is closed by
        // default rather than accidentally open — guest mode needs no token at all.
        if (clerkSettings.IsConfigured) options.Authority = clerkSettings.Authority;

        // OIDC discovery fetches and caches the signing keys, so key rotation needs no deploy.
        // Metadata must be fetched over HTTPS everywhere except a local Clerk proxy.
        options.RequireHttpsMetadata = !builder.Environment.IsDevelopment();

        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = clerkSettings.Authority,

            // Clerk session tokens carry no `aud` claim. Audience validation is therefore off
            // and the `azp` check in OnTokenValidated below takes its place.
            ValidateAudience = false,

            ValidateIssuerSigningKey = true,
            ValidateLifetime = true,

            // Clerk tokens live about a minute and the browser SDK refreshes them continuously.
            // The framework default of five minutes' leeway would keep a revoked token working
            // for far longer than its intended lifetime.
            ClockSkew = TimeSpan.FromSeconds(clerkSettings.ClockSkewSeconds),

            NameClaimType = "sub",
        };

        options.Events = new JwtBearerEvents
        {
            OnTokenValidated = context =>
            {
                var allowed = clerkSettings.AuthorizedParties;
                if (allowed.Count == 0) return Task.CompletedTask; // development escape hatch

                var azp = context.Principal?.FindFirstValue("azp");

                // A token minted for a different site on the same Clerk instance must not be
                // replayable here. Missing azp is treated as a failure when the list is set.
                if (string.IsNullOrEmpty(azp) || !allowed.Contains(azp, StringComparer.OrdinalIgnoreCase))
                {
                    context.Fail("The 'azp' claim does not name an authorized party.");
                }

                return Task.CompletedTask;
            },
        };
    });

builder.Services.AddAuthorization();

// ---------------------------------------------------------------------------
// CORS. Origins come from configuration so a new frontend host (a GitHub Pages
// custom domain, a preview deploy) is a Railway variable change, not a release.
// ---------------------------------------------------------------------------
const string CorsPolicy = "AllowFrontend";

var allowedOrigins = builder.Configuration
    .GetSection("Cors:AllowedOrigins")
    .Get<string[]>() ?? Array.Empty<string>();

builder.Services.AddCors(options =>
{
    options.AddPolicy(CorsPolicy, policy =>
    {
        if (allowedOrigins.Length == 0)
        {
            // No configured origins: allow local dev hosts only. Never a wildcard, because the
            // API is credentialed and a wildcard would let any page on the internet call it.
            policy.WithOrigins(
                "http://localhost:3000", "http://127.0.0.1:3000",
                "http://localhost:5173", "http://127.0.0.1:5173");
        }
        else
        {
            policy.WithOrigins(allowedOrigins);
        }

        policy.AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    // Partition by authenticated user where possible, falling back to remote IP. Partitioning
    // by IP alone would let one user on a shared campus NAT throttle a whole building.
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: context.User.FindFirstValue("sub")
                          ?? context.Connection.RemoteIpAddress?.ToString()
                          ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 300,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
            }));

    // LLM-backed endpoints cost real money per call, so they get their own much tighter bucket
    // on top of the global one.
    options.AddPolicy("llm", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: context.User.FindFirstValue("sub")
                          ?? context.Connection.RemoteIpAddress?.ToString()
                          ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 10,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
            }));
});

// ---------------------------------------------------------------------------
// Application services
// ---------------------------------------------------------------------------
builder.Services.AddScoped<ICurrentUserAccessor, CurrentUserAccessor>();
builder.Services.AddScoped<IGradeReadService, GradeReadService>();
builder.Services.AddScoped<ILlmUsageTracker, LlmUsageTracker>();
builder.Services.AddScoped<ISyllabusParserService, SyllabusParserService>();
builder.Services.AddScoped<IGradeAdvisorService, GradeAdvisorService>();

builder.Services.AddHttpClient<ILlmClient, OpenAiLlmClient>();

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddHealthChecks()
    .AddDbContextCheck<AppDbContext>("database", tags: new[] { "ready" });

var app = builder.Build();

// ---------------------------------------------------------------------------
// Schema. Migrations rather than EnsureCreated: EnsureCreated cannot evolve an
// existing database, so the first schema change after launch would have meant
// dropping production data.
// ---------------------------------------------------------------------------
if (app.Configuration.GetValue("Database:AutoMigrate", true))
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();

    try
    {
        await db.Database.MigrateAsync();
        logger.LogInformation("Database schema is up to date.");
    }
    catch (Exception ex)
    {
        logger.LogCritical(ex, "Database migration failed; the API cannot serve requests.");
        throw;
    }
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------
app.UseSerilogRequestLogging();

app.UseMiddleware<ExceptionHandlingMiddleware>();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}
else
{
    // Railway terminates TLS at its edge and forwards over plain HTTP internally, so an
    // in-process HTTPS redirect would loop. HSTS still instructs browsers to stay on HTTPS.
    app.UseHsts();
}

app.UseCors(CorsPolicy);

app.UseRateLimiter();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// Liveness: is the process up? Must not touch the database, or a brief database blip would
// cause the platform to kill an otherwise healthy container.
app.MapHealthChecks("/health", new HealthCheckOptions { Predicate = _ => false });

// Readiness: can it actually serve traffic?
app.MapHealthChecks("/health/ready", new HealthCheckOptions { Predicate = check => check.Tags.Contains("ready") });

app.Run();

/// <summary>Exposed so the integration tests can drive the real pipeline via WebApplicationFactory.</summary>
public partial class Program { }
