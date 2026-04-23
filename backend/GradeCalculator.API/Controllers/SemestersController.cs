using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using GradeCalculator.API.Data;
using GradeCalculator.API.DTOs.Requests;
using GradeCalculator.API.DTOs.Responses;
using GradeCalculator.API.Models;
using GradeCalculator.API.Services.Interfaces;
using System.Security.Claims;

namespace GradeCalculator.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class SemestersController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IGpaCalculatorService _gpaCalculator;

    public SemestersController(AppDbContext context, IGpaCalculatorService gpaCalculator)
    {
        _context = context;
        _gpaCalculator = gpaCalculator;
    }

    // GET: api/semesters
    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<SemesterResponse>>>> GetSemesters()
    {
        var userId = GetUserId();
        var semesters = await _context.Semesters
            .Include(s => s.Classes)
                .ThenInclude(c => c.GradeScale)
            .Include(s => s.Classes)
                .ThenInclude(c => c.Categories)
                    .ThenInclude(cat => cat.GradeItems)
            .Include(s => s.Classes)
                .ThenInclude(c => c.Categories)
                    .ThenInclude(cat => cat.Rules)
            .Where(s => s.UserId == userId)
            .OrderByDescending(s => s.Year)
            .ThenBy(s => s.Term)
            .ToListAsync();

        // Also get all classes for cumulative GPA
        var allClasses = semesters.SelectMany(s => s.Classes).ToList();
        var semesterClassGroups = semesters.Select(s => s.Classes.AsEnumerable()).ToList();
        var cumulativeGpa = _gpaCalculator.CalculateCumulativeGpa(semesterClassGroups);

        var response = semesters.Select(s => MapToSemesterResponse(s, cumulativeGpa)).ToList();
        return Ok(ApiResponse<List<SemesterResponse>>.Ok(response));
    }

    // GET: api/semesters/5
    [HttpGet("{id}")]
    public async Task<ActionResult<ApiResponse<SemesterResponse>>> GetSemester(int id)
    {
        var userId = GetUserId();
        var semester = await _context.Semesters
            .Include(s => s.Classes)
                .ThenInclude(c => c.GradeScale)
            .Include(s => s.Classes)
                .ThenInclude(c => c.Categories)
                    .ThenInclude(cat => cat.GradeItems)
            .Include(s => s.Classes)
                .ThenInclude(c => c.Categories)
                    .ThenInclude(cat => cat.Rules)
            .FirstOrDefaultAsync(s => s.Id == id);

        if (semester == null) return NotFound(ApiResponse<SemesterResponse>.Fail("Semester not found"));
        if (semester.UserId != userId) return Forbid();

        // Get all user semesters for cumulative GPA
        var allSemesters = await _context.Semesters
            .Include(s => s.Classes).ThenInclude(c => c.GradeScale)
            .Include(s => s.Classes).ThenInclude(c => c.Categories).ThenInclude(cat => cat.GradeItems)
            .Include(s => s.Classes).ThenInclude(c => c.Categories).ThenInclude(cat => cat.Rules)
            .Where(s => s.UserId == userId).ToListAsync();
        var cumulativeGpa = _gpaCalculator.CalculateCumulativeGpa(allSemesters.Select(s => s.Classes.AsEnumerable()));

        return Ok(ApiResponse<SemesterResponse>.Ok(MapToSemesterResponse(semester, cumulativeGpa)));
    }

    // POST: api/semesters
    [HttpPost]
    public async Task<ActionResult<ApiResponse<SemesterResponse>>> CreateSemester(CreateSemesterRequest request)
    {
        var userId = GetUserId();
        var semester = new Semester
        {
            Name = request.Name,
            Year = request.Year,
            Term = request.Term,
            GpaGoal = request.GpaGoal,
            UserId = userId,
            CreatedAt = DateTime.UtcNow
        };
        _context.Semesters.Add(semester);
        await _context.SaveChangesAsync();
        semester.Classes = new List<Class>();
        return CreatedAtAction(nameof(GetSemester), new { id = semester.Id },
            ApiResponse<SemesterResponse>.Ok(MapToSemesterResponse(semester, null)));
    }

    // PUT: api/semesters/5
    [HttpPut("{id}")]
    public async Task<ActionResult<ApiResponse<SemesterResponse>>> UpdateSemester(int id, UpdateSemesterRequest request)
    {
        var userId = GetUserId();
        var semester = await _context.Semesters
            .Include(s => s.Classes).ThenInclude(c => c.GradeScale)
            .Include(s => s.Classes).ThenInclude(c => c.Categories).ThenInclude(cat => cat.GradeItems)
            .Include(s => s.Classes).ThenInclude(c => c.Categories).ThenInclude(cat => cat.Rules)
            .FirstOrDefaultAsync(s => s.Id == id);

        if (semester == null) return NotFound(ApiResponse<SemesterResponse>.Fail("Semester not found"));
        if (semester.UserId != userId) return Forbid();

        semester.Name = request.Name;
        semester.Year = request.Year;
        semester.Term = request.Term;
        semester.GpaGoal = request.GpaGoal;
        await _context.SaveChangesAsync();

        var allSemesters = await _context.Semesters
            .Include(s => s.Classes).ThenInclude(c => c.GradeScale)
            .Include(s => s.Classes).ThenInclude(c => c.Categories).ThenInclude(cat => cat.GradeItems)
            .Include(s => s.Classes).ThenInclude(c => c.Categories).ThenInclude(cat => cat.Rules)
            .Where(s => s.UserId == userId).ToListAsync();
        var cumulativeGpa = _gpaCalculator.CalculateCumulativeGpa(allSemesters.Select(s => s.Classes.AsEnumerable()));

        return Ok(ApiResponse<SemesterResponse>.Ok(MapToSemesterResponse(semester, cumulativeGpa)));
    }

    // DELETE: api/semesters/5
    [HttpDelete("{id}")]
    public async Task<ActionResult<ApiResponse<bool>>> DeleteSemester(int id)
    {
        var userId = GetUserId();
        var semester = await _context.Semesters.FindAsync(id);
        if (semester == null) return NotFound(ApiResponse<bool>.Fail("Semester not found"));
        if (semester.UserId != userId) return Forbid();

        _context.Semesters.Remove(semester);
        await _context.SaveChangesAsync();
        return Ok(ApiResponse<bool>.Ok(true, "Semester deleted"));
    }

    private int GetUserId() =>
        int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "0");

    private SemesterResponse MapToSemesterResponse(Semester s, decimal? cumulativeGpa)
    {
        var semesterGpa = _gpaCalculator.CalculateSemesterGpa(s.Classes);
        var goalProgress = _gpaCalculator.CalculateGpaGoalProgress(semesterGpa, s.GpaGoal);

        return new SemesterResponse
        {
            Id = s.Id,
            Name = s.Name,
            Year = s.Year,
            Term = s.Term,
            GpaGoal = s.GpaGoal,
            SemesterGpa = semesterGpa,
            CumulativeGpa = cumulativeGpa,
            GpaGoalProgress = goalProgress,
            ClassCount = s.Classes.Count,
            Classes = s.Classes.Select(c =>
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
                    SemesterId = c.SemesterId,
                    CurrentGrade = currentGrade,
                    LetterGrade = letterGrade,
                    Gpa = gpa,
                    GradeScale = c.GradeScale != null ? new GradeScaleResponse
                    {
                        APlus = c.GradeScale.APlus, A = c.GradeScale.A, AMinus = c.GradeScale.AMinus,
                        BPlus = c.GradeScale.BPlus, B = c.GradeScale.B, BMinus = c.GradeScale.BMinus,
                        CPlus = c.GradeScale.CPlus, C = c.GradeScale.C, CMinus = c.GradeScale.CMinus,
                        DPlus = c.GradeScale.DPlus, D = c.GradeScale.D, DMinus = c.GradeScale.DMinus
                    } : null,
                    Categories = new List<CategoryResponse>()
                };
            }).ToList(),
            CreatedAt = s.CreatedAt
        };
    }
}
