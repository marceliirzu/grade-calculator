using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using GradeCalculator.API.Auth;
using GradeCalculator.API.Data;
using GradeCalculator.API.DTOs.Requests;
using GradeCalculator.API.DTOs.Responses;
using GradeCalculator.API.Models;
using GradeCalculator.API.Services;
using GradeCalculator.API.Services.Interfaces;

namespace GradeCalculator.API.Controllers;

public class GradesController : ApiControllerBase
{
    private readonly AppDbContext _db;
    private readonly IGradeReadService _grades;

    public GradesController(ICurrentUserAccessor currentUser, AppDbContext db, IGradeReadService grades)
        : base(currentUser)
    {
        _db = db;
        _grades = grades;
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse<ClassResponse>>> Create(
        [FromBody] CreateGradeRequest request, CancellationToken cancellationToken)
    {
        var userId = await CurrentUserIdAsync(cancellationToken);
        var category = await LoadOwnedCategoryAsync(request.CategoryId, userId, cancellationToken);

        var nextSortOrder = request.SortOrder ?? await _db.GradeItems
            .Where(g => g.CategoryId == request.CategoryId)
            .Select(g => (int?)g.SortOrder)
            .MaxAsync(cancellationToken) + 1 ?? 0;

        _db.GradeItems.Add(new GradeItem
        {
            CategoryId = request.CategoryId,
            Name = request.Name.Trim(),
            PointsEarned = request.PointsEarned,
            PointsPossible = request.PointsPossible,
            IsWhatIf = request.IsWhatIf,
            SortOrder = nextSortOrder,
            CreatedAt = DateTime.UtcNow,
        });

        await _db.SaveChangesAsync(cancellationToken);

        return Ok(ApiResponse<ClassResponse>.Ok(await _grades.GetClassAsync(category.ClassId, userId, cancellationToken)));
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<ApiResponse<ClassResponse>>> Update(
        int id, [FromBody] UpdateGradeRequest request, CancellationToken cancellationToken)
    {
        var userId = await CurrentUserIdAsync(cancellationToken);
        var item = await LoadOwnedItemAsync(id, userId, cancellationToken);

        if (request.Name is not null) item.Name = request.Name.Trim();

        // Clearing a score and leaving it untouched are different operations, and JSON cannot
        // tell them apart from a null alone -- hence the explicit flag.
        if (request.ClearPointsEarned) item.PointsEarned = null;
        else if (request.PointsEarned is not null) item.PointsEarned = request.PointsEarned;

        if (request.PointsPossible is not null) item.PointsPossible = request.PointsPossible.Value;
        if (request.IsWhatIf is not null) item.IsWhatIf = request.IsWhatIf.Value;
        if (request.SortOrder is not null) item.SortOrder = request.SortOrder.Value;

        await _db.SaveChangesAsync(cancellationToken);

        return Ok(ApiResponse<ClassResponse>.Ok(
            await _grades.GetClassAsync(item.Category!.ClassId, userId, cancellationToken)));
    }

    [HttpDelete("{id:int}")]
    public async Task<ActionResult<ApiResponse<ClassResponse>>> Delete(int id, CancellationToken cancellationToken)
    {
        var userId = await CurrentUserIdAsync(cancellationToken);
        var item = await LoadOwnedItemAsync(id, userId, cancellationToken);
        var classId = item.Category!.ClassId;

        _db.GradeItems.Remove(item);
        await _db.SaveChangesAsync(cancellationToken);

        return Ok(ApiResponse<ClassResponse>.Ok(await _grades.GetClassAsync(classId, userId, cancellationToken)));
    }

    private async Task<Category> LoadOwnedCategoryAsync(int categoryId, int userId, CancellationToken cancellationToken) =>
        await _db.Categories
            .FirstOrDefaultAsync(c => c.Id == categoryId && c.Class!.UserId == userId, cancellationToken)
        ?? throw new ResourceNotFoundException("Category", categoryId);

    private async Task<GradeItem> LoadOwnedItemAsync(int itemId, int userId, CancellationToken cancellationToken) =>
        await _db.GradeItems
            .Include(g => g.Category)
            .FirstOrDefaultAsync(g => g.Id == itemId && g.Category!.Class!.UserId == userId, cancellationToken)
        ?? throw new ResourceNotFoundException("Grade item", itemId);
}
