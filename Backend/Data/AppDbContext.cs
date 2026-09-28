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
        public DbSet<Assignment> Assignments { get; set; }
        public DbSet<Attendance> Attendances { get; set; }
        public DbSet<SalaryPayment> SalaryPayments { get; set; }
        public DbSet<Invoice> Invoices { get; set; }
        public DbSet<InvoiceItem> InvoiceItems { get; set; }
        public DbSet<InvoicePayment> InvoicePayments { get; set; }
        public DbSet<MaterialRequest> MaterialRequests { get; set; }
        public DbSet<ProjectExpense> ProjectExpenses { get; set; }
        public DbSet<UserPreference> UserPreferences { get; set; }
        public DbSet<CompanySetting> CompanySettings { get; set; }
        public DbSet<CompanyHoliday> CompanyHolidays { get; set; }

        // Every sign-in attempt; successful ones are also the sessions behind the tokens.
        public DbSet<LoginActivity> LoginActivities { get; set; }

        public DbSet<Alert> Alerts { get; set; }
        public DbSet<AlertRule> AlertRules { get; set; }

        // Registry of isolated visitor demo databases (only ever filled in the main database).
        public DbSet<DemoSession> DemoSessions { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // An expense belongs to a project. Restrict (not cascade): the database itself refuses
            // to delete a project that still has expenses, so cost history is never lost silently.
            modelBuilder.Entity<ProjectExpense>()
                .HasOne<Project>()
                .WithMany()
                .HasForeignKey(e => e.ProjectID)
                .OnDelete(DeleteBehavior.Restrict);

            // An invoice line may bill one expense. Restrict keeps a billed expense from being
            // deleted, and the unique index stops the same expense being billed twice.
            modelBuilder.Entity<InvoiceItem>()
                .HasOne<ProjectExpense>()
                .WithMany()
                .HasForeignKey(i => i.ExpenseID)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<InvoiceItem>()
                .HasIndex(i => i.ExpenseID)
                .IsUnique()
                .HasFilter("[ExpenseID] IS NOT NULL");

            // Display settings belong to one user and go away with that user.
            modelBuilder.Entity<UserPreference>()
                .HasOne<User>()
                .WithOne()
                .HasForeignKey<UserPreference>(p => p.UserID)
                .OnDelete(DeleteBehavior.Cascade);

            // Sign-in history goes away with its user (rows of unknown usernames have no user).
            modelBuilder.Entity<LoginActivity>()
                .HasOne<User>()
                .WithMany()
                .HasForeignKey(a => a.UserID)
                .OnDelete(DeleteBehavior.Cascade);

            // Settings > Security lists one user's history; sign-in counts failures per
            // username and IP address; old rows are deleted by date.
            modelBuilder.Entity<LoginActivity>().HasIndex(a => new { a.UserID, a.CreatedAt });
            modelBuilder.Entity<LoginActivity>().HasIndex(a => new { a.Username, a.IpAddress, a.CreatedAt });
            modelBuilder.Entity<LoginActivity>().HasIndex(a => a.CreatedAt);

            modelBuilder.Entity<Alert>()
                .HasIndex(a => a.Key)
                .IsUnique()
                .HasFilter("[Status] = 'Open'");
            modelBuilder.Entity<Alert>().HasIndex(a => new { a.Status, a.ResolvedAt });

            modelBuilder.Entity<Alert>()
                .HasOne<User>()
                .WithMany()
                .HasForeignKey(a => a.UserID)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}