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
    
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        
        // User
        modelBuilder.Entity<User>(entity =>
        {
            entity.HasIndex(u => u.GoogleId).IsUnique();
            entity.HasIndex(u => u.Email).IsUnique();
            
            // Seed a default dev user
            entity.HasData(new User
            {
                Id = 1,
                Email = "dev@gradecalculator.local",
                Name = "Dev User",
                GoogleId = "dev-local-user",
                CreatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            });
        });
        
        // Class
        modelBuilder.Entity<Class>(entity =>
        {
            entity.HasOne(c => c.User)
                  .WithMany(u => u.Classes)
                  .HasForeignKey(c => c.UserId)
                  .OnDelete(DeleteBehavior.Cascade);
                  
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
