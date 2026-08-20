namespace GradeCalculator.API.Services;

/// <summary>
/// The resource does not exist, or does exist but belongs to a different user.
///
/// Both cases deliberately produce the same 404. Returning 403 for "exists but not yours" would
/// confirm that a given id is real, letting anyone enumerate how many classes exist.
/// </summary>
public sealed class ResourceNotFoundException : Exception
{
    public ResourceNotFoundException(string resource, object id)
        : base($"{resource} {id} was not found.") { }

    public ResourceNotFoundException(string message) : base(message) { }
}

/// <summary>Input that passed model binding but violates a domain rule.</summary>
public sealed class ValidationFailedException : Exception
{
    public ValidationFailedException(string message) : base(message) { }
}

/// <summary>The caller has spent their allowance of a metered resource (LLM tokens).</summary>
public sealed class QuotaExceededException : Exception
{
    public QuotaExceededException(string message) : base(message) { }
}

/// <summary>
/// A feature is switched off because it has not been configured — for example the syllabus
/// parser's LLM fallback when no API key is present. Distinct from a crash: the deployment is
/// simply missing an optional key, and the client should degrade gracefully rather than retry.
/// </summary>
public sealed class FeatureUnavailableException : Exception
{
    public FeatureUnavailableException(string message) : base(message) { }
}
