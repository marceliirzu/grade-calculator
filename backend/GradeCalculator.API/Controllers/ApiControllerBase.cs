using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using GradeCalculator.API.Auth;

namespace GradeCalculator.API.Controllers;

/// <summary>
/// Base for every authenticated endpoint.
///
/// <see cref="Authorize"/> lives here rather than on each controller so that adding a new
/// controller cannot accidentally ship an unauthenticated endpoint — the failure mode of
/// per-controller attributes is silent and severe.
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
[Produces("application/json")]
public abstract class ApiControllerBase : ControllerBase
{
    private readonly ICurrentUserAccessor _currentUser;

    protected ApiControllerBase(ICurrentUserAccessor currentUser) => _currentUser = currentUser;

    /// <summary>
    /// Local user id for the caller, provisioning the row on first use.
    ///
    /// Every query in every controller filters on this. Ownership is enforced in the WHERE
    /// clause rather than by loading a row and then checking it, so there is no window in which
    /// another user's entity exists in memory.
    /// </summary>
    protected Task<int> CurrentUserIdAsync(CancellationToken cancellationToken) =>
        _currentUser.GetUserIdAsync(User, cancellationToken);
}
