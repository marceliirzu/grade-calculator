using Microsoft.EntityFrameworkCore;
using GradeCalculator.API.Models;

namespace GradeCalculator.API.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }
    
    public DbSet<User> Users => Set<User>();
    public DbSet<Class> Classes => Set<Class>();
    public DbSet<GradeScale> GradeScales => Set<GradeScale>();
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<GradeItem> GradeItems => Set<GradeItem>();
    public DbSet<Rule> Rules => Set<Rule>();
    public DbSet<Semester> Semesters => Set<Semester>();
    
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        
        // User
        modelBuilder.Entity<User>(entity =>
        {
            entity.HasIndex(u => u.GoogleId).IsUnique();
            entity.HasIndex(u => u.Email).IsUnique();
        });
        
        // Class
        modelBuilder.Entity<Class>(entity =>
        {
            entity.HasOne(c => c.User)
                  .WithMany(u => u.Classes)
                  .HasForeignKey(c => c.UserId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(c => c.Semester)
                  .WithMany(s => s.Classes)
                  .HasForeignKey(c => c.SemesterId)
                  .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(c => c.GradeScale)
                  .WithOne(g => g.Class)
                  .HasForeignKey<GradeScale>(g => g.ClassId)
                  .OnDelete(DeleteBehavior.Cascade);
        });
        
        // Category
        modelBuilder.Entity<Category>(entity =>
        {
            entity.HasOne(c => c.Class)
                  .WithMany(cl => cl.Categories)
                  .HasForeignKey(c => c.ClassId)
                  .OnDelete(DeleteBehavior.Cascade);
        });
        
        // GradeItem
        modelBuilder.Entity<GradeItem>(entity =>
        {
            entity.HasOne(g => g.Category)
                  .WithMany(c => c.GradeItems)
                  .HasForeignKey(g => g.CategoryId)
                  .OnDelete(DeleteBehavior.Cascade);
                  
            entity.Property(g => g.PointsEarned).HasPrecision(10, 2);
            entity.Property(g => g.PointsPossible).HasPrecision(10, 2);
        });
        
        // Rule
        modelBuilder.Entity<Rule>(entity =>
        {
            entity.HasOne(r => r.Category)
                  .WithMany(c => c.Rules)
                  .HasForeignKey(r => r.CategoryId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // Semester
        modelBuilder.Entity<Semester>(entity =>
        {
            entity.HasOne(s => s.User)
                  .WithMany(u => u.Semesters)
                  .HasForeignKey(s => s.UserId)
                  .OnDelete(DeleteBehavior.Cascade);
            entity.Property(s => s.GpaGoal).HasPrecision(3, 2);
        });

        // GradeScale precision
        modelBuilder.Entity<GradeScale>(entity =>
        {
            entity.Property(g => g.APlus).HasPrecision(5, 2);
            entity.Property(g => g.A).HasPrecision(5, 2);
            entity.Property(g => g.AMinus).HasPrecision(5, 2);
            entity.Property(g => g.BPlus).HasPrecision(5, 2);
            entity.Property(g => g.B).HasPrecision(5, 2);
            entity.Property(g => g.BMinus).HasPrecision(5, 2);
            entity.Property(g => g.CPlus).HasPrecision(5, 2);
            entity.Property(g => g.C).HasPrecision(5, 2);
            entity.Property(g => g.CMinus).HasPrecision(5, 2);
            entity.Property(g => g.DPlus).HasPrecision(5, 2);
            entity.Property(g => g.D).HasPrecision(5, 2);
            entity.Property(g => g.DMinus).HasPrecision(5, 2);
            entity.Property(g => g.APlusGpaValue).HasPrecision(3, 2);
        });
    }
}
