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

public class ClassesController : ApiControllerBase
{
    private readonly AppDbContext _db;
    private readonly IGradeReadService _grades;

    public ClassesController(ICurrentUserAccessor currentUser, AppDbContext db, IGradeReadService grades)
        : base(currentUser)
    {
        _db = db;
        _grades = grades;
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<ClassResponse>>>> GetAll(
        [FromQuery] int? semesterId, CancellationToken cancellationToken)
    {
        var userId = await CurrentUserIdAsync(cancellationToken);
        var classes = await _grades.GetClassesAsync(userId, semesterId, cancellationToken);

        return Ok(ApiResponse<List<ClassResponse>>.Ok(classes));
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<ApiResponse<ClassResponse>>> Get(int id, CancellationToken cancellationToken)
    {
        var userId = await CurrentUserIdAsync(cancellationToken);
        var cls = await _grades.GetClassAsync(id, userId, cancellationToken);

        return Ok(ApiResponse<ClassResponse>.Ok(cls, warnings: cls.Warnings));
    }

    [HttpGet("gpa")]
    public async Task<ActionResult<ApiResponse<GpaResponse>>> GetGpa(
        [FromQuery] int? semesterId, CancellationToken cancellationToken)
    {
        var userId = await CurrentUserIdAsync(cancellationToken);

        return Ok(ApiResponse<GpaResponse>.Ok(await _grades.GetGpaAsync(userId, semesterId, cancellationToken)));
    }

    /// <summary>What score is needed on the remaining work to finish on a given letter grade.</summary>
    [HttpGet("{id:int}/target/{letter}")]
    public async Task<ActionResult<ApiResponse<TargetGradeResponse>>> GetTarget(
        int id, string letter, CancellationToken cancellationToken)
    {
        var userId = await CurrentUserIdAsync(cancellationToken);

        return Ok(ApiResponse<TargetGradeResponse>.Ok(
            await _grades.GetTargetAsync(id, userId, letter, cancellationToken)));
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse<ClassResponse>>> Create(
        [FromBody] CreateClassRequest request, CancellationToken cancellationToken)
    {
        var userId = await CurrentUserIdAsync(cancellationToken);

        await EnsureSemesterOwnedAsync(request.SemesterId, userId, cancellationToken);

        var entity = new Class
        {
            UserId = userId,
            Name = request.Name.Trim(),
            CreditHours = request.CreditHours,
            ShowOnlyCAndUp = request.ShowOnlyCAndUp,
            SemesterId = request.SemesterId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            // Created together with the class so no class can ever exist without a scale --
            // the state that used to force a silent fallback at grading time.
            GradeScale = new GradeScale(),
        };

        _db.Classes.Add(entity);
        await _db.SaveChangesAsync(cancellationToken);

        var created = await _grades.GetClassAsync(entity.Id, userId, cancellationToken);

        return CreatedAtAction(nameof(Get), new { id = entity.Id }, ApiResponse<ClassResponse>.Ok(created));
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<ApiResponse<ClassResponse>>> Update(
        int id, [FromBody] UpdateClassRequest request, CancellationToken cancellationToken)
    {
        var userId = await CurrentUserIdAsync(cancellationToken);

        var entity = await _db.Classes.FirstOrDefaultAsync(c => c.Id == id && c.UserId == userId, cancellationToken)
                     ?? throw new ResourceNotFoundException("Class", id);

        await EnsureSemesterOwnedAsync(request.SemesterId, userId, cancellationToken);

        entity.Name = request.Name.Trim();
        entity.CreditHours = request.CreditHours;
        entity.ShowOnlyCAndUp = request.ShowOnlyCAndUp;
        entity.SemesterId = request.SemesterId;
        entity.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(cancellationToken);

        return Ok(ApiResponse<ClassResponse>.Ok(await _grades.GetClassAsync(id, userId, cancellationToken)));
    }

    [HttpPut("{id:int}/grade-scale")]
    public async Task<ActionResult<ApiResponse<ClassResponse>>> UpdateGradeScale(
        int id, [FromBody] UpdateGradeScaleRequest request, CancellationToken cancellationToken)
    {
        if (!request.IsMonotonic())
        {
            throw new ValidationFailedException(
                "Grade thresholds must decrease from A+ down to D-.");
        }

        var userId = await CurrentUserIdAsync(cancellationToken);

        var entity = await _db.Classes
            .Include(c => c.GradeScale)
            .FirstOrDefaultAsync(c => c.Id == id && c.UserId == userId, cancellationToken)
            ?? throw new ResourceNotFoundException("Class", id);

        var scale = entity.GradeScale;
        if (scale is null)
        {
            scale = new GradeScale { ClassId = entity.Id };
            _db.GradeScales.Add(scale);
        }

        scale.APlusGpaValue = request.APlusGpaValue;
        scale.APlus = request.APlus;
        scale.A = request.A;
        scale.AMinus = request.AMinus;
        scale.BPlus = request.BPlus;
        scale.B = request.B;
        scale.BMinus = request.BMinus;
        scale.CPlus = request.CPlus;
        scale.C = request.C;
        scale.CMinus = request.CMinus;
        scale.DPlus = request.DPlus;
        scale.D = request.D;
        scale.DMinus = request.DMinus;

        entity.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);

        return Ok(ApiResponse<ClassResponse>.Ok(await _grades.GetClassAsync(id, userId, cancellationToken)));
    }

    [HttpDelete("{id:int}")]
    public async Task<ActionResult<ApiResponse<object>>> Delete(int id, CancellationToken cancellationToken)
    {
        var userId = await CurrentUserIdAsync(cancellationToken);

        var entity = await _db.Classes.FirstOrDefaultAsync(c => c.Id == id && c.UserId == userId, cancellationToken)
                     ?? throw new ResourceNotFoundException("Class", id);

        // Categories, items, rules and the scale all cascade -- configured in AppDbContext.
        _db.Classes.Remove(entity);
        await _db.SaveChangesAsync(cancellationToken);

        return Ok(ApiResponse<object>.Ok(new { deleted = id }));
    }

    /// <summary>
    /// Rejects a semester id belonging to someone else. Without this a caller could file their
    /// class under another user's semester by guessing an integer.
    /// </summary>
    private async Task EnsureSemesterOwnedAsync(int? semesterId, int userId, CancellationToken cancellationToken)
    {
        if (semesterId is null) return;

        var exists = await _db.Semesters
            .AnyAsync(s => s.Id == semesterId && s.UserId == userId, cancellationToken);

        if (!exists) throw new ResourceNotFoundException("Semester", semesterId);
    }
}
