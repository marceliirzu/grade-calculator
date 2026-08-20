using Microsoft.EntityFrameworkCore;
using GradeCalculator.API.Models;

namespace GradeCalculator.API.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<User> Users => Set<User>();
    public DbSet<Class> Classes => Set<Class>();
    public DbSet<GradeScale> GradeScales => Set<GradeScale>();
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<GradeItem> GradeItems => Set<GradeItem>();
    public DbSet<Rule> Rules => Set<Rule>();
    public DbSet<Semester> Semesters => Set<Semester>();
    public DbSet<SyllabusParseCache> SyllabusParseCaches => Set<SyllabusParseCache>();
    public DbSet<LlmUsage> LlmUsages => Set<LlmUsage>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<User>(entity =>
        {
            // The Clerk id is the real identity key and must be unique.
            entity.HasIndex(u => u.ClerkUserId).IsUnique();

            // Email is intentionally NOT unique: Clerk allows an address to be freed up and
            // reused by a different account, and a unique index here would reject that user
            // forever. Look-ups always go through ClerkUserId.
            entity.HasIndex(u => u.Email);
        });

        modelBuilder.Entity<Class>(entity =>
        {
            entity.HasOne(c => c.User)
                  .WithMany(u => u.Classes)
                  .HasForeignKey(c => c.UserId)
                  .OnDelete(DeleteBehavior.Cascade);

            // Deleting a semester keeps its classes; they fall back to "unassigned" rather than
            // silently destroying a term's worth of grades.
            entity.HasOne(c => c.Semester)
                  .WithMany(s => s.Classes)
                  .HasForeignKey(c => c.SemesterId)
                  .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(c => c.GradeScale)
                  .WithOne(g => g.Class)
                  .HasForeignKey<GradeScale>(g => g.ClassId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(c => new { c.UserId, c.SemesterId });
        });

        modelBuilder.Entity<Category>(entity =>
        {
            entity.HasOne(c => c.Class)
                  .WithMany(cl => cl.Categories)
                  .HasForeignKey(c => c.ClassId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(c => c.ClassId);
            entity.Property(c => c.Weight).HasPrecision(6, 3);
        });

        modelBuilder.Entity<GradeItem>(entity =>
        {
            entity.HasOne(g => g.Category)
                  .WithMany(c => c.GradeItems)
                  .HasForeignKey(g => g.CategoryId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(g => g.CategoryId);
            entity.Property(g => g.PointsEarned).HasPrecision(10, 2);
            entity.Property(g => g.PointsPossible).HasPrecision(10, 2);
        });

        modelBuilder.Entity<Rule>(entity =>
        {
            entity.HasOne(r => r.Category)
                  .WithMany(c => c.Rules)
                  .HasForeignKey(r => r.CategoryId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(r => r.CategoryId);
            entity.Property(r => r.Type).HasConversion<int>();
        });

        modelBuilder.Entity<Semester>(entity =>
        {
            entity.HasOne(s => s.User)
                  .WithMany(u => u.Semesters)
                  .HasForeignKey(s => s.UserId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(s => s.UserId);
            entity.Property(s => s.GpaGoal).HasPrecision(4, 2);
        });

        modelBuilder.Entity<GradeScale>(entity =>
        {
            entity.Property(g => g.APlusGpaValue).HasPrecision(4, 2);

            foreach (var threshold in new[]
                     {
                         nameof(GradeScale.APlus), nameof(GradeScale.A), nameof(GradeScale.AMinus),
                         nameof(GradeScale.BPlus), nameof(GradeScale.B), nameof(GradeScale.BMinus),
                         nameof(GradeScale.CPlus), nameof(GradeScale.C), nameof(GradeScale.CMinus),
                         nameof(GradeScale.DPlus), nameof(GradeScale.D), nameof(GradeScale.DMinus),
                     })
            {
                entity.Property(threshold).HasPrecision(5, 2);
            }
        });

        modelBuilder.Entity<SyllabusParseCache>(entity =>
        {
            entity.HasIndex(c => c.ContentHash).IsUnique();
            entity.Property(c => c.ResultJson).HasColumnType("TEXT");
        });

        modelBuilder.Entity<LlmUsage>(entity =>
        {
            entity.HasOne(u => u.User)
                  .WithMany()
                  .HasForeignKey(u => u.UserId)
                  .OnDelete(DeleteBehavior.SetNull);

            // The quota check is "sum tokens for this user since midnight UTC", so the index
            // has to lead with UserId and then CreatedAt to be seekable.
            entity.HasIndex(u => new { u.UserId, u.CreatedAt });
            entity.Property(u => u.Feature).HasConversion<int>();
        });
    }
}
