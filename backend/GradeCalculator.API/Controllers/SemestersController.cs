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

public class SemestersController : ApiControllerBase
{
    private static readonly string[] ValidTerms = { "Fall", "Spring", "Summer", "Winter" };

    private readonly AppDbContext _db;
    private readonly IGradeReadService _grades;

    public SemestersController(ICurrentUserAccessor currentUser, AppDbContext db, IGradeReadService grades)
        : base(currentUser)
    {
        _db = db;
        _grades = grades;
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<SemesterResponse>>>> GetAll(CancellationToken cancellationToken)
    {
        var userId = await CurrentUserIdAsync(cancellationToken);

        return Ok(ApiResponse<List<SemesterResponse>>.Ok(await _grades.GetSemestersAsync(userId, cancellationToken)));
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<ApiResponse<SemesterResponse>>> Get(int id, CancellationToken cancellationToken)
    {
        var userId = await CurrentUserIdAsync(cancellationToken);

        return Ok(ApiResponse<SemesterResponse>.Ok(await _grades.GetSemesterAsync(id, userId, cancellationToken)));
    }

    [HttpGet("cumulative-gpa")]
    public async Task<ActionResult<ApiResponse<object>>> GetCumulativeGpa(CancellationToken cancellationToken)
    {
        var userId = await CurrentUserIdAsync(cancellationToken);
        var gpa = await _grades.GetCumulativeGpaAsync(userId, cancellationToken);

        return Ok(ApiResponse<object>.Ok(new { cumulativeGpa = gpa }));
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse<SemesterResponse>>> Create(
        [FromBody] CreateSemesterRequest request, CancellationToken cancellationToken)
    {
        var userId = await CurrentUserIdAsync(cancellationToken);
        var term = NormaliseTerm(request.Term);

        var entity = new Semester
        {
            UserId = userId,
            Name = request.Name.Trim(),
            Year = request.Year,
            Term = term,
            GpaGoal = request.GpaGoal,
            CreatedAt = DateTime.UtcNow,
        };

        _db.Semesters.Add(entity);
        await _db.SaveChangesAsync(cancellationToken);

        var created = await _grades.GetSemesterAsync(entity.Id, userId, cancellationToken);

        return CreatedAtAction(nameof(Get), new { id = entity.Id }, ApiResponse<SemesterResponse>.Ok(created));
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<ApiResponse<SemesterResponse>>> Update(
        int id, [FromBody] UpdateSemesterRequest request, CancellationToken cancellationToken)
    {
        var userId = await CurrentUserIdAsync(cancellationToken);

        var entity = await _db.Semesters.FirstOrDefaultAsync(s => s.Id == id && s.UserId == userId, cancellationToken)
                     ?? throw new ResourceNotFoundException("Semester", id);

        if (request.Name is not null) entity.Name = request.Name.Trim();
        if (request.Year is not null) entity.Year = request.Year.Value;
        if (request.Term is not null) entity.Term = NormaliseTerm(request.Term);

        if (request.ClearGpaGoal) entity.GpaGoal = null;
        else if (request.GpaGoal is not null) entity.GpaGoal = request.GpaGoal;

        await _db.SaveChangesAsync(cancellationToken);

        return Ok(ApiResponse<SemesterResponse>.Ok(await _grades.GetSemesterAsync(id, userId, cancellationToken)));
    }

    [HttpDelete("{id:int}")]
    public async Task<ActionResult<ApiResponse<object>>> Delete(int id, CancellationToken cancellationToken)
    {
        var userId = await CurrentUserIdAsync(cancellationToken);

        var entity = await _db.Semesters.FirstOrDefaultAsync(s => s.Id == id && s.UserId == userId, cancellationToken)
                     ?? throw new ResourceNotFoundException("Semester", id);

        // Classes survive with SemesterId set to null (see AppDbContext). Deleting a term must
        // not take a term's worth of grades with it.
        _db.Semesters.Remove(entity);
        await _db.SaveChangesAsync(cancellationToken);

        return Ok(ApiResponse<object>.Ok(new { deleted = id }));
    }

    private static string NormaliseTerm(string term)
    {
        var match = ValidTerms.FirstOrDefault(t => string.Equals(t, term.Trim(), StringComparison.OrdinalIgnoreCase));

        return match ?? throw new ValidationFailedException(
            $"'{term}' is not a term. Use one of: {string.Join(", ", ValidTerms)}.");
    }
}
