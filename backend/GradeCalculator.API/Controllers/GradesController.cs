using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using GradeCalculator.API.Data;
using GradeCalculator.API.DTOs.Requests;
using GradeCalculator.API.DTOs.Responses;
using GradeCalculator.API.Models;

namespace GradeCalculator.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class GradesController : ControllerBase
{
    private readonly AppDbContext _context;
    
    public GradesController(AppDbContext context)
    {
        _context = context;
    }
    
    // POST: api/grades
    [HttpPost]
    public async Task<ActionResult<ApiResponse<GradeItemResponse>>> CreateGrade(CreateGradeRequest request)
    {
        var categoryExists = await _context.Categories.AnyAsync(c => c.Id == request.CategoryId);
        if (!categoryExists)
            return NotFound(ApiResponse<GradeItemResponse>.Fail("Category not found"));
        
        var maxOrder = await _context.GradeItems
            .Where(g => g.CategoryId == request.CategoryId)
            .MaxAsync(g => (int?)g.SortOrder) ?? -1;
        
        var gradeItem = new GradeItem
        {
            CategoryId = request.CategoryId,
            Name = request.Name,
            PointsEarned = request.PointsEarned,
            PointsPossible = request.PointsPossible,
            IsWhatIf = request.IsWhatIf,
            SortOrder = maxOrder + 1
        };
        
        _context.GradeItems.Add(gradeItem);
        await _context.SaveChangesAsync();
        
        return CreatedAtAction(nameof(GetGrade), new { id = gradeItem.Id },
            ApiResponse<GradeItemResponse>.Ok(MapToResponse(gradeItem)));
    }
    
    // GET: api/grades/5
    [HttpGet("{id}")]
    public async Task<ActionResult<ApiResponse<GradeItemResponse>>> GetGrade(int id)
    {
        var gradeItem = await _context.GradeItems.FindAsync(id);
        
        if (gradeItem == null)
            return NotFound(ApiResponse<GradeItemResponse>.Fail("Grade not found"));
        
        return Ok(ApiResponse<GradeItemResponse>.Ok(MapToResponse(gradeItem)));
    }
    
    // PUT: api/grades/5
    [HttpPut("{id}")]
    public async Task<ActionResult<ApiResponse<GradeItemResponse>>> UpdateGrade(int id, CreateGradeRequest request)
    {
        var gradeItem = await _context.GradeItems.FindAsync(id);
        
        if (gradeItem == null)
            return NotFound(ApiResponse<GradeItemResponse>.Fail("Grade not found"));
        
        gradeItem.Name = request.Name;
        gradeItem.PointsEarned = request.PointsEarned;
        gradeItem.PointsPossible = request.PointsPossible;
        gradeItem.IsWhatIf = request.IsWhatIf;
        
        await _context.SaveChangesAsync();
        
        return Ok(ApiResponse<GradeItemResponse>.Ok(MapToResponse(gradeItem)));
    }
    
    // DELETE: api/grades/5
    [HttpDelete("{id}")]
    public async Task<ActionResult<ApiResponse<bool>>> DeleteGrade(int id)
    {
        var gradeItem = await _context.GradeItems.FindAsync(id);
        
        if (gradeItem == null)
            return NotFound(ApiResponse<bool>.Fail("Grade not found"));
        
        _context.GradeItems.Remove(gradeItem);
        await _context.SaveChangesAsync();
        
        return Ok(ApiResponse<bool>.Ok(true, "Grade deleted"));
    }
    
    // PUT: api/grades/5/whatif
    [HttpPut("{id}/whatif")]
    public async Task<ActionResult<ApiResponse<GradeItemResponse>>> ToggleWhatIf(int id)
    {
        var gradeItem = await _context.GradeItems.FindAsync(id);
        
        if (gradeItem == null)
            return NotFound(ApiResponse<GradeItemResponse>.Fail("Grade not found"));
        
        gradeItem.IsWhatIf = !gradeItem.IsWhatIf;
        await _context.SaveChangesAsync();
        
        return Ok(ApiResponse<GradeItemResponse>.Ok(MapToResponse(gradeItem)));
    }
    
    private GradeItemResponse MapToResponse(GradeItem g) => new()
    {
        Id = g.Id,
        Name = g.Name,
        PointsEarned = g.PointsEarned,
        PointsPossible = g.PointsPossible,
        Percentage = g.GetPercentage(),
        IsWhatIf = g.IsWhatIf
    };
}
