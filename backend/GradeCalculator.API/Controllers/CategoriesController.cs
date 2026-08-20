using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using GradeCalculator.API.Auth;
using GradeCalculator.API.Data;
using GradeCalculator.API.DTOs.Requests;
using GradeCalculator.API.DTOs.Responses;
using GradeCalculator.API.Grading;
using GradeCalculator.API.Models;
using GradeCalculator.API.Services;
using GradeCalculator.API.Services.Interfaces;

namespace GradeCalculator.API.Controllers;

public class CategoriesController : ApiControllerBase
{
    private readonly AppDbContext _db;
    private readonly IGradeReadService _grades;

    public CategoriesController(ICurrentUserAccessor currentUser, AppDbContext db, IGradeReadService grades)
        : base(currentUser)
    {
        _db = db;
        _grades = grades;
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse<ClassResponse>>> Create(
        [FromBody] CreateCategoryRequest request, CancellationToken cancellationToken)
    {
        var userId = await CurrentUserIdAsync(cancellationToken);
        await EnsureClassOwnedAsync(request.ClassId, userId, cancellationToken);

        var nextSortOrder = request.SortOrder ?? await _db.Categories
            .Where(c => c.ClassId == request.ClassId)
            .Select(c => (int?)c.SortOrder)
            .MaxAsync(cancellationToken) + 1 ?? 0;

        _db.Categories.Add(new Category
        {
            ClassId = request.ClassId,
            Name = request.Name.Trim(),
            Weight = request.Weight,
            SortOrder = nextSortOrder,
            CreatedAt = DateTime.UtcNow,
        });

        await _db.SaveChangesAsync(cancellationToken);

        return Ok(ApiResponse<ClassResponse>.Ok(await _grades.GetClassAsync(request.ClassId, userId, cancellationToken)));
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<ApiResponse<ClassResponse>>> Update(
        int id, [FromBody] UpdateCategoryRequest request, CancellationToken cancellationToken)
    {
        var userId = await CurrentUserIdAsync(cancellationToken);
        var category = await LoadOwnedAsync(id, userId, cancellationToken);

        if (request.Name is not null) category.Name = request.Name.Trim();
        if (request.Weight is not null) category.Weight = request.Weight.Value;
        if (request.SortOrder is not null) category.SortOrder = request.SortOrder.Value;

        await _db.SaveChangesAsync(cancellationToken);

        return Ok(ApiResponse<ClassResponse>.Ok(await _grades.GetClassAsync(category.ClassId, userId, cancellationToken)));
    }

    [HttpDelete("{id:int}")]
    public async Task<ActionResult<ApiResponse<ClassResponse>>> Delete(int id, CancellationToken cancellationToken)
    {
        var userId = await CurrentUserIdAsync(cancellationToken);
        var category = await LoadOwnedAsync(id, userId, cancellationToken);
        var classId = category.ClassId;

        _db.Categories.Remove(category);
        await _db.SaveChangesAsync(cancellationToken);

        return Ok(ApiResponse<ClassResponse>.Ok(await _grades.GetClassAsync(classId, userId, cancellationToken)));
    }

    // ---- Rules ----

    [HttpPost("rules")]
    public async Task<ActionResult<ApiResponse<ClassResponse>>> CreateRule(
        [FromBody] CreateRuleRequest request, CancellationToken cancellationToken)
    {
        var userId = await CurrentUserIdAsync(cancellationToken);
        var category = await LoadOwnedAsync(request.CategoryId, userId, cancellationToken);

        if (!Enum.TryParse<RuleKind>(request.Type, ignoreCase: true, out var kind))
        {
            throw new ValidationFailedException(
                $"'{request.Type}' is not a rule type. Use DropLowest, CountHighest or WeightByScore.");
        }

        string? weights = null;

        if (kind == RuleKind.WeightByScore)
        {
            if (request.WeightDistribution is not { Count: > 0 })
                throw new ValidationFailedException("A WeightByScore rule needs a list of weights.");

            if (request.WeightDistribution.Any(w => w < 0))
                throw new ValidationFailedException("Weights cannot be negative.");

            if (request.WeightDistribution.Sum() <= 0)
                throw new ValidationFailedException("Weights must add up to more than zero.");

            weights = JsonSerializer.Serialize(request.WeightDistribution);
        }

        // One rule of each kind per category. Two DropLowest rules would compose into a silent
        // double-drop that no part of the UI communicates.
        var existing = await _db.Rules
            .FirstOrDefaultAsync(r => r.CategoryId == request.CategoryId && r.Type == kind, cancellationToken);

        if (existing is not null)
        {
            existing.Value = request.Value;
            existing.WeightDistribution = weights;
        }
        else
        {
            _db.Rules.Add(new Rule
            {
                CategoryId = request.CategoryId,
                Type = kind,
                Value = request.Value,
                WeightDistribution = weights,
                CreatedAt = DateTime.UtcNow,
            });
        }

        await _db.SaveChangesAsync(cancellationToken);

        return Ok(ApiResponse<ClassResponse>.Ok(await _grades.GetClassAsync(category.ClassId, userId, cancellationToken)));
    }

    [HttpDelete("rules/{id:int}")]
    public async Task<ActionResult<ApiResponse<ClassResponse>>> DeleteRule(int id, CancellationToken cancellationToken)
    {
        var userId = await CurrentUserIdAsync(cancellationToken);

        var rule = await _db.Rules
            .Include(r => r.Category)
            .FirstOrDefaultAsync(r => r.Id == id && r.Category!.Class!.UserId == userId, cancellationToken)
            ?? throw new ResourceNotFoundException("Rule", id);

        var classId = rule.Category!.ClassId;

        _db.Rules.Remove(rule);
        await _db.SaveChangesAsync(cancellationToken);

        return Ok(ApiResponse<ClassResponse>.Ok(await _grades.GetClassAsync(classId, userId, cancellationToken)));
    }

    // ---- Ownership ----

    private async Task<Category> LoadOwnedAsync(int categoryId, int userId, CancellationToken cancellationToken) =>
        await _db.Categories
            .FirstOrDefaultAsync(c => c.Id == categoryId && c.Class!.UserId == userId, cancellationToken)
        ?? throw new ResourceNotFoundException("Category", categoryId);

    private async Task EnsureClassOwnedAsync(int classId, int userId, CancellationToken cancellationToken)
    {
        var exists = await _db.Classes.AnyAsync(c => c.Id == classId && c.UserId == userId, cancellationToken);
        if (!exists) throw new ResourceNotFoundException("Class", classId);
    }
}
