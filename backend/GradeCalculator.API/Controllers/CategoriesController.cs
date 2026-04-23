using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using GradeCalculator.API.Data;
using GradeCalculator.API.DTOs.Requests;
using GradeCalculator.API.DTOs.Responses;
using GradeCalculator.API.Models;

namespace GradeCalculator.API.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class CategoriesController : ControllerBase
{
    private readonly AppDbContext _context;

    public CategoriesController(AppDbContext context)
    {
        _context = context;
    }

    private int GetUserId() =>
        int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "0");

    // POST: api/categories
    [HttpPost]
    public async Task<ActionResult<ApiResponse<CategoryResponse>>> CreateCategory(CreateCategoryRequest request)
    {
        var cls = await _context.Classes.FindAsync(request.ClassId);
        if (cls == null)
            return NotFound(ApiResponse<CategoryResponse>.Fail("Class not found"));

        if (cls.UserId != GetUserId())
            return Forbid();

        var maxOrder = await _context.Categories
            .Where(c => c.ClassId == request.ClassId)
            .MaxAsync(c => (int?)c.SortOrder) ?? -1;

        var category = new Category
        {
            ClassId = request.ClassId,
            Name = request.Name,
            Weight = request.Weight,
            SortOrder = maxOrder + 1
        };

        _context.Categories.Add(category);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetCategory), new { id = category.Id },
            ApiResponse<CategoryResponse>.Ok(MapToResponse(category)));
    }

    // GET: api/categories/5
    [HttpGet("{id}")]
    public async Task<ActionResult<ApiResponse<CategoryResponse>>> GetCategory(int id)
    {
        var category = await _context.Categories
            .Include(c => c.Class)
            .Include(c => c.GradeItems)
            .Include(c => c.Rules)
            .FirstOrDefaultAsync(c => c.Id == id);

        if (category == null)
            return NotFound(ApiResponse<CategoryResponse>.Fail("Category not found"));

        if (category.Class?.UserId != GetUserId())
            return Forbid();

        return Ok(ApiResponse<CategoryResponse>.Ok(MapToResponse(category)));
    }

    // PUT: api/categories/5
    [HttpPut("{id}")]
    public async Task<ActionResult<ApiResponse<CategoryResponse>>> UpdateCategory(int id, CreateCategoryRequest request)
    {
        var category = await _context.Categories
            .Include(c => c.Class)
            .FirstOrDefaultAsync(c => c.Id == id);

        if (category == null)
            return NotFound(ApiResponse<CategoryResponse>.Fail("Category not found"));

        if (category.Class?.UserId != GetUserId())
            return Forbid();

        category.Name = request.Name;
        category.Weight = request.Weight;

        await _context.SaveChangesAsync();

        return Ok(ApiResponse<CategoryResponse>.Ok(MapToResponse(category)));
    }

    // DELETE: api/categories/5
    [HttpDelete("{id}")]
    public async Task<ActionResult<ApiResponse<bool>>> DeleteCategory(int id)
    {
        var category = await _context.Categories
            .Include(c => c.Class)
            .FirstOrDefaultAsync(c => c.Id == id);

        if (category == null)
            return NotFound(ApiResponse<bool>.Fail("Category not found"));

        if (category.Class?.UserId != GetUserId())
            return Forbid();

        _context.Categories.Remove(category);
        await _context.SaveChangesAsync();

        return Ok(ApiResponse<bool>.Ok(true, "Category deleted"));
    }

    // POST: api/categories/5/rules
    [HttpPost("{id}/rules")]
    public async Task<ActionResult<ApiResponse<RuleResponse>>> AddRule(int id, CreateRuleRequest request)
    {
        var category = await _context.Categories
            .Include(c => c.Class)
            .FirstOrDefaultAsync(c => c.Id == id);

        if (category == null)
            return NotFound(ApiResponse<RuleResponse>.Fail("Category not found"));

        if (category.Class?.UserId != GetUserId())
            return Forbid();

        if (!Enum.TryParse<RuleType>(request.Type, out var ruleType))
            return BadRequest(ApiResponse<RuleResponse>.Fail("Invalid rule type"));

        var rule = new Rule
        {
            CategoryId = id,
            Type = ruleType,
            Value = request.Value,
            WeightDistribution = request.WeightDistribution != null
                ? System.Text.Json.JsonSerializer.Serialize(request.WeightDistribution)
                : null
        };

        _context.Rules.Add(rule);
        await _context.SaveChangesAsync();

        return Ok(ApiResponse<RuleResponse>.Ok(new RuleResponse
        {
            Id = rule.Id,
            Type = rule.Type.ToString(),
            Value = rule.Value,
            WeightDistribution = request.WeightDistribution
        }));
    }

    // DELETE: api/categories/rules/5
    [HttpDelete("rules/{ruleId}")]
    public async Task<ActionResult<ApiResponse<bool>>> DeleteRule(int ruleId)
    {
        var rule = await _context.Rules
            .Include(r => r.Category)
                .ThenInclude(c => c!.Class)
            .FirstOrDefaultAsync(r => r.Id == ruleId);

        if (rule == null)
            return NotFound(ApiResponse<bool>.Fail("Rule not found"));

        if (rule.Category?.Class?.UserId != GetUserId())
            return Forbid();

        _context.Rules.Remove(rule);
        await _context.SaveChangesAsync();

        return Ok(ApiResponse<bool>.Ok(true, "Rule deleted"));
    }

    private CategoryResponse MapToResponse(Category c) => new()
    {
        Id = c.Id,
        Name = c.Name,
        Weight = c.Weight,
        GradeItems = c.GradeItems?.Select(g => new GradeItemResponse
        {
            Id = g.Id,
            Name = g.Name,
            PointsEarned = g.PointsEarned,
            PointsPossible = g.PointsPossible,
            Percentage = g.GetPercentage(),
            IsWhatIf = g.IsWhatIf
        }).ToList() ?? new(),
        Rules = c.Rules?.Select(r => new RuleResponse
        {
            Id = r.Id,
            Type = r.Type.ToString(),
            Value = r.Value
        }).ToList() ?? new()
    };
}
