using Backend.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace Backend.Data
{
    // The database context - the main bridge between our C# code and the SQL Server database.
    // EF Core uses this class to know which tables exist and to run all queries.
    public class AppDbContext : DbContext
    {
        // Constructor - receives database configuration (like the connection string) from Program.cs
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
        {
        }

        // Each DbSet represents a table in the database.
        // Clients is the table name; it holds records of type Client.
        public DbSet<Client> Clients { get; set; }
        public DbSet<User> Users { get; set; }
        public DbSet<Employee> Employees { get; set; }
        public DbSet<Inquiry> Inquiries { get; set; }
        public DbSet<UserPermission> UserPermissions { get; set; }
        public DbSet<PendingAction> PendingActions { get; set; }
        public DbSet<Notification> Notifications { get; set; }
        public DbSet<Material> Materials { get; set; }
        public DbSet<MaterialTransaction> MaterialTransactions { get; set; }
        public DbSet<Project> Projects { get; set; }
        public DbSet<ProjectPhase> ProjectPhases { get; set; }
    }
}