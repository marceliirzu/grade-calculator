using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace GradeCalculator.API.Data;

/// <summary>
/// Used only by <c>dotnet ef</c> at design time.
///
/// Without this, adding a migration boots the whole application host, which means it needs a
/// real reachable database — so nobody could generate a migration without production-shaped
/// credentials on their machine, and CI could not verify migrations at all. EF only needs the
/// provider to know how to translate the model, never a live connection, so a syntactically
/// valid dummy string is enough.
/// </summary>
public sealed class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    private const string DesignTimeConnection = "Server=localhost;Port=3306;Database=gradecalculator_design;Uid=root;Pwd=design;";

    public AppDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseMySql(DesignTimeConnection, new MySqlServerVersion(new Version(8, 0, 36)))
            .Options;

        return new AppDbContext(options);
    }
}
