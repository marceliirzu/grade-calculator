using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using GradeCalculator.API.Data;
using GradeCalculator.API.Services;
using GradeCalculator.API.Services.Interfaces;
using GradeCalculator.API.Configuration;
using GradeCalculator.API.Middleware;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Database — build connection string from Railway env vars
static string BuildConnectionString(IConfiguration config)
{
    var cs = config.GetConnectionString("DefaultConnection");

    // If it's a real connection string (not placeholder/SQLite), use it directly
    if (!string.IsNullOrWhiteSpace(cs) && !cs.StartsWith("Data Source=") && !cs.Contains("SET_MYSQL"))
        return cs;

    // Try MYSQL_URL or DATABASE_URL (full URI format: mysql://user:pass@host:port/db)
    var mysqlUrl = Environment.GetEnvironmentVariable("MYSQL_URL")
                   ?? Environment.GetEnvironmentVariable("DATABASE_URL")
                   ?? Environment.GetEnvironmentVariable("MYSQL_PRIVATE_URL");

    if (mysqlUrl != null && mysqlUrl.StartsWith("mysql://"))
    {
        var uri = new Uri(mysqlUrl);
        var userInfo = uri.UserInfo.Split(':');
        var user = userInfo[0];
        var pwd  = userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : "";
        var host = uri.Host;
        var port = uri.Port > 0 ? uri.Port : 3306;
        var db   = uri.AbsolutePath.TrimStart('/');
        return $"Server={host};Port={port};Database={db};Uid={user};Pwd={pwd};";
    }

    // Fall back to individual MYSQLHOST / MYSQL_HOST vars
    var h = Environment.GetEnvironmentVariable("MYSQLHOST") ?? Environment.GetEnvironmentVariable("MYSQL_HOST");
    var p = Environment.GetEnvironmentVariable("MYSQLPORT") ?? Environment.GetEnvironmentVariable("MYSQL_PORT") ?? "3306";
    var d = Environment.GetEnvironmentVariable("MYSQLDATABASE") ?? Environment.GetEnvironmentVariable("MYSQL_DATABASE") ?? "railway";
    var u = Environment.GetEnvironmentVariable("MYSQLUSER") ?? Environment.GetEnvironmentVariable("MYSQL_USER");
    var pw = Environment.GetEnvironmentVariable("MYSQLPASSWORD") ?? Environment.GetEnvironmentVariable("MYSQL_PASSWORD");

    if (h != null && u != null && pw != null)
        return $"Server={h};Port={p};Database={d};Uid={u};Pwd={pw};";

    throw new InvalidOperationException("No MySQL connection string found. Set MYSQL_URL or ConnectionStrings__DefaultConnection.");
}

var connectionString = BuildConnectionString(builder.Configuration);
var serverVersion = new MySqlServerVersion(new Version(8, 0, 0));

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseMySql(connectionString, serverVersion));

// Configuration
builder.Services.Configure<JwtSettings>(builder.Configuration.GetSection("Jwt"));
builder.Services.Configure<OpenAiSettings>(builder.Configuration.GetSection("OpenAi"));

// HttpClient Factory (needed for Google token verification)
builder.Services.AddHttpClient();

// Services
builder.Services.AddScoped<IGpaCalculatorService, GpaCalculatorService>();
builder.Services.AddScoped<IGradeRulesService, GradeRulesService>();
builder.Services.AddScoped<ISyllabusParserService, SyllabusParserService>();
builder.Services.AddScoped<IOpenAiService, OpenAiService>();
builder.Services.AddHttpClient<IOpenAiService, OpenAiService>();
builder.Services.AddScoped<IGradeAdvisorService, GradeAdvisorService>();
builder.Services.AddScoped<ITargetGradeCalculatorService, TargetGradeCalculatorService>();

// Authentication
var jwtSettings = builder.Configuration.GetSection("Jwt").Get<JwtSettings>();
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtSettings?.Issuer,
            ValidAudience = jwtSettings?.Audience,
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(jwtSettings?.Secret ?? "default-secret-key-change-me"))
        };
    });

// CORS - Allow both local and production
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins(
                "http://localhost:3000",
                "http://localhost:5500",
                "http://127.0.0.1:5500",
                "https://getyourgpa.com",
                "https://www.getyourgpa.com",
                "https://calcyourgpa.com",
                "https://www.calcyourgpa.com"
            )
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

var app = builder.Build();

// Configure the HTTP request pipeline
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseMiddleware<ExceptionHandlingMiddleware>();

// Don't redirect to HTTPS in development
if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}

app.UseCors("AllowFrontend");
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// Auto-create database
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.EnsureCreated();
}

app.Run();
