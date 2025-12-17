using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using GradeCalculator.API.Data;
using GradeCalculator.API.DTOs.Requests;
using GradeCalculator.API.DTOs.Responses;
using GradeCalculator.API.Models;
using GradeCalculator.API.Services.Interfaces;

namespace GradeCalculator.API.Controllers;

[ApiController]
[Route("api/[controller]")]
// [Authorize] // Uncomment when auth is set up
public class ClassesController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IGpaCalculatorService _gpaCalculator;
    
    public ClassesController(AppDbContext context, IGpaCalculatorService gpaCalculator)
    {
        _context = context;
        _gpaCalculator = gpaCalculator;
    }
    
    // GET: api/classes
    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<ClassResponse>>>> GetClasses()
    {
        // TODO: Get user ID from claims when auth is set up
        var userId = 1; // Temporary
        
        var classes = await _context.Classes
            .Include(c => c.GradeScale)
            .Include(c => c.Categories)
                .ThenInclude(cat => cat.GradeItems)
            .Include(c => c.Categories)
                .ThenInclude(cat => cat.Rules)
            .Where(c => c.UserId == userId)
            .ToListAsync();
        
        var response = classes.Select(MapToClassResponse).ToList();
        
        return Ok(ApiResponse<List<ClassResponse>>.Ok(response));
    }
    
    // GET: api/classes/5
    [HttpGet("{id}")]
    public async Task<ActionResult<ApiResponse<ClassResponse>>> GetClass(int id)
    {
        var classEntity = await _context.Classes
            .Include(c => c.GradeScale)
            .Include(c => c.Categories)
                .ThenInclude(cat => cat.GradeItems)
            .Include(c => c.Categories)
                .ThenInclude(cat => cat.Rules)
            .FirstOrDefaultAsync(c => c.Id == id);
        
        if (classEntity == null)
            return NotFound(ApiResponse<ClassResponse>.Fail("Class not found"));
        
        return Ok(ApiResponse<ClassResponse>.Ok(MapToClassResponse(classEntity)));
    }
    
    // POST: api/classes
    [HttpPost]
    public async Task<ActionResult<ApiResponse<ClassResponse>>> CreateClass(CreateClassRequest request)
    {
        // TODO: Get user ID from claims
        var userId = 1; // Temporary
        
        var classEntity = new Class
        {
            UserId = userId,
            Name = request.Name,
            CreditHours = request.CreditHours,
            ShowOnlyCAndUp = request.ShowOnlyCAndUp
        };
        
        // Create default grade scale
        classEntity.GradeScale = new GradeScale();
        
        // Create default categories
        classEntity.Categories = new List<Category>
        {
            new() { Name = "Assignments", Weight = 30, SortOrder = 0 },
            new() { Name = "Quizzes", Weight = 20, SortOrder = 1 },
            new() { Name = "Exams", Weight = 50, SortOrder = 2 }
        };
        
        _context.Classes.Add(classEntity);
        await _context.SaveChangesAsync();
        
        // Reload with navigation properties
        await _context.Entry(classEntity).Reference(c => c.GradeScale).LoadAsync();
        await _context.Entry(classEntity).Collection(c => c.Categories).LoadAsync();
        
        return CreatedAtAction(nameof(GetClass), new { id = classEntity.Id }, 
            ApiResponse<ClassResponse>.Ok(MapToClassResponse(classEntity)));
    }
    
    // PUT: api/classes/5
    [HttpPut("{id}")]
    public async Task<ActionResult<ApiResponse<ClassResponse>>> UpdateClass(int id, CreateClassRequest request)
    {
        var classEntity = await _context.Classes
            .Include(c => c.GradeScale)
            .Include(c => c.Categories)
                .ThenInclude(cat => cat.GradeItems)
            .FirstOrDefaultAsync(c => c.Id == id);
        
        if (classEntity == null)
            return NotFound(ApiResponse<ClassResponse>.Fail("Class not found"));
        
        classEntity.Name = request.Name;
        classEntity.CreditHours = request.CreditHours;
        classEntity.ShowOnlyCAndUp = request.ShowOnlyCAndUp;
        classEntity.UpdatedAt = DateTime.UtcNow;
        
        await _context.SaveChangesAsync();
        
        return Ok(ApiResponse<ClassResponse>.Ok(MapToClassResponse(classEntity)));
    }
    
    // DELETE: api/classes/5
    [HttpDelete("{id}")]
    public async Task<ActionResult<ApiResponse<bool>>> DeleteClass(int id)
    {
        var classEntity = await _context.Classes.FindAsync(id);
        
        if (classEntity == null)
            return NotFound(ApiResponse<bool>.Fail("Class not found"));
        
        _context.Classes.Remove(classEntity);
        await _context.SaveChangesAsync();
        
        return Ok(ApiResponse<bool>.Ok(true, "Class deleted"));
    }
    
    // PUT: api/classes/5/gradescale
    [HttpPut("{id}/gradescale")]
    public async Task<ActionResult<ApiResponse<GradeScaleResponse>>> UpdateGradeScale(int id, UpdateGradeScaleRequest request)
    {
        var gradeScale = await _context.GradeScales.FirstOrDefaultAsync(g => g.ClassId == id);
        
        if (gradeScale == null)
            return NotFound(ApiResponse<GradeScaleResponse>.Fail("Grade scale not found"));
        
        gradeScale.APlus = request.APlus;
        gradeScale.A = request.A;
        gradeScale.AMinus = request.AMinus;
        gradeScale.BPlus = request.BPlus;
        gradeScale.B = request.B;
        gradeScale.BMinus = request.BMinus;
        gradeScale.CPlus = request.CPlus;
        gradeScale.C = request.C;
        gradeScale.CMinus = request.CMinus;
        gradeScale.DPlus = request.DPlus;
        gradeScale.D = request.D;
        gradeScale.DMinus = request.DMinus;
        
        await _context.SaveChangesAsync();
        
        return Ok(ApiResponse<GradeScaleResponse>.Ok(MapToGradeScaleResponse(gradeScale)));
    }
    
    private ClassResponse MapToClassResponse(Class c)
    {
        var currentGrade = _gpaCalculator.CalculateClassGrade(c);
        string? letterGrade = null;
        decimal? gpa = null;
        
        if (currentGrade.HasValue && c.GradeScale != null)
        {
            letterGrade = c.GradeScale.GetLetterGrade(currentGrade.Value);
            gpa = c.GradeScale.GetGpaPoints(letterGrade);
        }
        
        return new ClassResponse
        {
            Id = c.Id,
            Name = c.Name,
            CreditHours = c.CreditHours,
            ShowOnlyCAndUp = c.ShowOnlyCAndUp,
            CurrentGrade = currentGrade,
            LetterGrade = letterGrade,
            Gpa = gpa,
            GradeScale = c.GradeScale != null ? MapToGradeScaleResponse(c.GradeScale) : null,
            Categories = c.Categories.Select(cat => new CategoryResponse
            {
                Id = cat.Id,
                Name = cat.Name,
                Weight = cat.Weight,
                CurrentGrade = _gpaCalculator.CalculateCategoryGrade(cat),
                GradeItems = cat.GradeItems.Select(g => new GradeItemResponse
                {
                    Id = g.Id,
                    Name = g.Name,
                    PointsEarned = g.PointsEarned,
                    PointsPossible = g.PointsPossible,
                    Percentage = g.GetPercentage(),
                    IsWhatIf = g.IsWhatIf
                }).ToList(),
                Rules = cat.Rules.Select(r => new RuleResponse
                {
                    Id = r.Id,
                    Type = r.Type.ToString(),
                    Value = r.Value,
                    WeightDistribution = !string.IsNullOrEmpty(r.WeightDistribution) 
                        ? System.Text.Json.JsonSerializer.Deserialize<List<decimal>>(r.WeightDistribution) 
                        : null
                }).ToList()
            }).ToList()
        };
    }
    
    private GradeScaleResponse MapToGradeScaleResponse(GradeScale g) => new()
    {
        APlus = g.APlus,
        A = g.A,
        AMinus = g.AMinus,
        BPlus = g.BPlus,
        B = g.B,
        BMinus = g.BMinus,
        CPlus = g.CPlus,
        C = g.C,
        CMinus = g.CMinus,
        DPlus = g.DPlus,
        D = g.D,
        DMinus = g.DMinus
    };
}
