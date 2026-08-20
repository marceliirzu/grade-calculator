namespace GradeCalculator.API.Configuration;

/// <summary>
/// Resolves the MySQL connection string from whichever shape the host supplies it in.
///
/// Railway hands out connection details three different ways depending on how the database was
/// attached, and which one you get is not obvious from the dashboard. Supporting all three here
/// is the difference between a deploy that works and an afternoon of guessing.
/// </summary>
public static class DatabaseConfiguration
{
    /// <summary>Marker used by the committed appsettings.json so placeholders are never mistaken for real values.</summary>
    private const string PlaceholderPrefix = "SET_";

    public static string Resolve(IConfiguration configuration)
    {
        // 1. An explicit connection string always wins (ConnectionStrings__DefaultConnection).
        var explicitConnection = configuration.GetConnectionString("DefaultConnection");
        if (IsRealValue(explicitConnection)) return explicitConnection!;

        // 2. A full URI: mysql://user:pass@host:port/db
        var url = FirstSet(configuration, "MYSQL_URL", "DATABASE_URL", "MYSQL_PRIVATE_URL");
        if (url is not null && TryParseUri(url, out var fromUri)) return fromUri;

        // 3. Individual variables, in both the Railway and the conventional spellings.
        var host = FirstSet(configuration, "MYSQLHOST", "MYSQL_HOST");
        var user = FirstSet(configuration, "MYSQLUSER", "MYSQL_USER");
        var password = FirstSet(configuration, "MYSQLPASSWORD", "MYSQL_PASSWORD");
        var port = FirstSet(configuration, "MYSQLPORT", "MYSQL_PORT") ?? "3306";
        var database = FirstSet(configuration, "MYSQLDATABASE", "MYSQL_DATABASE") ?? "railway";

        if (host is not null && user is not null && password is not null)
            return $"Server={host};Port={port};Database={database};Uid={user};Pwd={password};";

        throw new InvalidOperationException(
            "No MySQL connection details found. Set ConnectionStrings__DefaultConnection, or MYSQL_URL, " +
            "or the MYSQLHOST/MYSQLUSER/MYSQLPASSWORD trio. " +
            "For local development, create appsettings.Development.json (it is gitignored).");
    }

    private static bool TryParseUri(string url, out string connectionString)
    {
        connectionString = string.Empty;

        if (!url.StartsWith("mysql://", StringComparison.OrdinalIgnoreCase)) return false;

        try
        {
            var uri = new Uri(url);
            var credentials = uri.UserInfo.Split(':', 2);

            var user = Uri.UnescapeDataString(credentials[0]);
            var password = credentials.Length > 1 ? Uri.UnescapeDataString(credentials[1]) : string.Empty;
            var port = uri.Port > 0 ? uri.Port : 3306;
            var database = uri.AbsolutePath.Trim('/');

            if (string.IsNullOrEmpty(database)) database = "railway";

            connectionString = $"Server={uri.Host};Port={port};Database={database};Uid={user};Pwd={password};";
            return true;
        }
        catch (UriFormatException)
        {
            return false;
        }
    }

    private static string? FirstSet(IConfiguration configuration, params string[] keys)
    {
        foreach (var key in keys)
        {
            var value = configuration[key];
            if (IsRealValue(value)) return value;
        }

        return null;
    }

    private static bool IsRealValue(string? value) =>
        !string.IsNullOrWhiteSpace(value) && !value.StartsWith(PlaceholderPrefix, StringComparison.Ordinal);
}
