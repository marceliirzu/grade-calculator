using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using GradeCalculator.API.Configuration;
using GradeCalculator.API.Data;
using GradeCalculator.API.DTOs.Responses;
using GradeCalculator.API.Models;

namespace GradeCalculator.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly JwtSettings _jwtSettings;
    private readonly IConfiguration _configuration;
    private readonly HttpClient _httpClient;
    private readonly ILogger<AuthController> _logger;
    
    public AuthController(
        AppDbContext context, 
        IOptions<JwtSettings> jwtSettings,
        IConfiguration configuration,
        IHttpClientFactory httpClientFactory,
        ILogger<AuthController> logger)
    {
        _context = context;
        _jwtSettings = jwtSettings.Value;
        _configuration = configuration;
        _httpClient = httpClientFactory.CreateClient();
        _logger = logger;
    }
    
    // POST: api/auth/google
    [HttpPost("google")]
    public async Task<ActionResult<ApiResponse<AuthResponse>>> GoogleLogin([FromBody] GoogleLoginRequest request)
    {
        try
        {
            // Verify the Google ID token
            var googleUser = await VerifyGoogleToken(request.IdToken);
            
            if (googleUser == null)
            {
                return BadRequest(ApiResponse<AuthResponse>.Fail("Invalid Google token"));
            }
            
            // Find or create user
            var user = await _context.Users.FirstOrDefaultAsync(u => u.GoogleId == googleUser.Sub);
            
            if (user == null)
            {
                // Create new user
                user = new User
                {
                    GoogleId = googleUser.Sub,
                    Email = googleUser.Email,
                    Name = googleUser.Name ?? googleUser.Email.Split('@')[0]
                };
                
                _context.Users.Add(user);
                await _context.SaveChangesAsync();
                _logger.LogInformation("New user created: {Email}", user.Email);
            }
            else
            {
                // Update existing user
                user.LastLoginAt = DateTime.UtcNow;
                user.Name = googleUser.Name ?? user.Name; // Update name if provided
                await _context.SaveChangesAsync();
                _logger.LogInformation("User logged in: {Email}", user.Email);
            }
            
            var token = GenerateJwtToken(user);
            
            return Ok(ApiResponse<AuthResponse>.Ok(new AuthResponse
            {
                Token = token,
                User = new UserResponse
                {
                    Id = user.Id,
                    Email = user.Email,
                    Name = user.Name
                }
            }));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Google login failed");
            return BadRequest(ApiResponse<AuthResponse>.Fail("Authentication failed"));
        }
    }
    
    // Verify Google ID token
    private async Task<GoogleUserInfo?> VerifyGoogleToken(string idToken)
    {
        try
        {
            // Google's token info endpoint
            var response = await _httpClient.GetAsync(
                $"https://oauth2.googleapis.com/tokeninfo?id_token={idToken}");
            
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Google token verification failed: {Status}", response.StatusCode);
                return null;
            }
            
            var json = await response.Content.ReadAsStringAsync();
            var tokenInfo = JsonSerializer.Deserialize<GoogleTokenInfo>(json, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });
            
            // Verify the token is for our app
            var expectedClientId = _configuration["Google:ClientId"];
            if (tokenInfo?.Aud != expectedClientId)
            {
                _logger.LogWarning("Token client ID mismatch. Expected: {Expected}, Got: {Got}", 
                    expectedClientId, tokenInfo?.Aud);
                return null;
            }
            
            return new GoogleUserInfo
            {
                Sub = tokenInfo.Sub,
                Email = tokenInfo.Email,
                Name = tokenInfo.Name
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error verifying Google token");
            return null;
        }
    }
    
    // POST: api/auth/dev-login
    // Development only - creates a test user without Google auth
    [HttpPost("dev-login")]
    public async Task<ActionResult<ApiResponse<AuthResponse>>> DevLogin([FromBody] DevLoginRequest? request = null)
    {
        // Only allow in development
        /*var env = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT");
        if (env != "Development")
        {
            return BadRequest(ApiResponse<AuthResponse>.Fail("Dev login not available in production"));
        }*/
        
        var email = request?.Email ?? "dev@gradecalculator.local";
        
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == email);
        
        if (user == null)
        {
            user = new User
            {
                GoogleId = "dev-user-" + Guid.NewGuid().ToString("N")[..8],
                Email = email,
                Name = "Dev User"
            };
            
            _context.Users.Add(user);
            await _context.SaveChangesAsync();
        }
        else
        {
            user.LastLoginAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
        }
        
        var token = GenerateJwtToken(user);
        
        return Ok(ApiResponse<AuthResponse>.Ok(new AuthResponse
        {
            Token = token,
            User = new UserResponse
            {
                Id = user.Id,
                Email = user.Email,
                Name = user.Name
            }
        }));
    }
    
    private string GenerateJwtToken(User user)
    {
        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Email, user.Email),
            new Claim(ClaimTypes.Name, user.Name)
        };
        
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwtSettings.Secret));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        
        var token = new JwtSecurityToken(
            issuer: _jwtSettings.Issuer,
            audience: _jwtSettings.Audience,
            claims: claims,
            expires: DateTime.UtcNow.AddDays(_jwtSettings.ExpirationInDays),
            signingCredentials: creds
        );
        
        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}

// Request/Response classes
public class GoogleLoginRequest
{
    public string IdToken { get; set; } = string.Empty;
}

public class DevLoginRequest
{
    public string? Email { get; set; }
}

public class AuthResponse
{
    public string Token { get; set; } = string.Empty;
    public UserResponse User { get; set; } = new();
}

public class UserResponse
{
    public int Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
}

// Google token info from verification endpoint
public class GoogleTokenInfo
{
    public string Sub { get; set; } = string.Empty; // Google user ID
    public string Email { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Aud { get; set; } = string.Empty; // Client ID
    public string Iss { get; set; } = string.Empty; // Issuer
}

public class GoogleUserInfo
{
    public string Sub { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? Name { get; set; }
}
