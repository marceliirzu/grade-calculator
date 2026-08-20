using GradeCalculator.API.DTOs.Responses;

namespace GradeCalculator.API.Services.Interfaces;

/// <summary>
/// Every read path that returns a computed grade goes through here.
///
/// Controllers deliberately cannot reach the grading engine directly. Concentrating the
/// entity-loading here is what guarantees the required <c>Include</c>s are always present:
/// a class loaded without its grade items would grade as "nothing submitted yet" and quietly
/// report the wrong number rather than failing.
/// </summary>
public interface IGradeReadService
{
    Task<ClassResponse> GetClassAsync(int classId, int userId, CancellationToken cancellationToken = default);

    Task<List<ClassResponse>> GetClassesAsync(int userId, int? semesterId, CancellationToken cancellationToken = default);

    Task<GpaResponse> GetGpaAsync(int userId, int? semesterId, CancellationToken cancellationToken = default);

    Task<SemesterResponse> GetSemesterAsync(int semesterId, int userId, CancellationToken cancellationToken = default);

    Task<List<SemesterResponse>> GetSemestersAsync(int userId, CancellationToken cancellationToken = default);

    Task<TargetGradeResponse> GetTargetAsync(int classId, int userId, string targetLetter, CancellationToken cancellationToken = default);

    /// <summary>Cumulative GPA across every class the user owns, in any semester.</summary>
    Task<decimal?> GetCumulativeGpaAsync(int userId, CancellationToken cancellationToken = default);
}
