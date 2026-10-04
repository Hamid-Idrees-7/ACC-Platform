using Backend.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace Backend.Data
{
    // EF Core context for the SQL Server database: the tables and how they relate.
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
        {
        }

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
        public DbSet<PasswordReset> PasswordResets { get; set; }

        public DbSet<Alert> Alerts { get; set; }
        public DbSet<AlertRule> AlertRules { get; set; }

        // Visitor demo databases (only ever filled in the main database).
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

            modelBuilder.Entity<PasswordReset>()
                .HasOne<User>()
                .WithMany()
                .HasForeignKey(r => r.UserID)
                .OnDelete(DeleteBehavior.Cascade);
            modelBuilder.Entity<PasswordReset>().HasIndex(r => r.CodeHash).IsUnique();
            modelBuilder.Entity<PasswordReset>().HasIndex(r => new { r.UserID, r.CreatedAt });

            modelBuilder.Entity<Alert>()
                .HasIndex(a => a.Key)
                .IsUnique()
                .HasFilter("[Status] = 'Open'");
            modelBuilder.Entity<Alert>().HasIndex(a => new { a.Status, a.ResolvedAt });

            // One record per thing, enforced by the database itself, so two saves at the same
            // moment can never create a duplicate:
            // one attendance row per assignment per day,
            modelBuilder.Entity<Attendance>().HasIndex(a => new { a.AssignmentID, a.Date }).IsUnique();
            // A salary line can be paid in parts, so its payments are only indexed for lookup.
            modelBuilder.Entity<SalaryPayment>()
                .HasIndex(p => new { p.EmployeeID, p.Year, p.Month, p.SourceType, p.AssignmentID });
            // one row per permission toggle,
            modelBuilder.Entity<UserPermission>().HasIndex(p => new { p.UserID, p.Module, p.Action }).IsUnique();
            // unique invoice numbers and usernames.
            modelBuilder.Entity<Invoice>().HasIndex(i => i.InvoiceNumber).IsUnique();
            modelBuilder.Entity<User>().HasIndex(u => u.Username).IsUnique();

            // Lookups that run on every page or every message.
            modelBuilder.Entity<Notification>().HasIndex(n => new { n.UserID, n.Type, n.IsRead });
            modelBuilder.Entity<Inquiry>().HasIndex(i => new { i.Phone, i.CreatedAt });

            // Lookups by project, person, invoice, month and day, which grow with every year of data.
            modelBuilder.Entity<Assignment>().HasIndex(a => a.ProjectID);
            modelBuilder.Entity<Assignment>().HasIndex(a => a.EmployeeID);
            modelBuilder.Entity<Attendance>().HasIndex(a => a.Date);
            modelBuilder.Entity<Invoice>().HasIndex(i => i.ProjectID);
            modelBuilder.Entity<InvoiceItem>().HasIndex(i => i.InvoiceID);
            modelBuilder.Entity<InvoicePayment>().HasIndex(p => p.InvoiceID);
            modelBuilder.Entity<MaterialTransaction>().HasIndex(t => t.ProjectID);
            modelBuilder.Entity<MaterialRequest>().HasIndex(r => r.Status);
            modelBuilder.Entity<SalaryPayment>().HasIndex(p => new { p.Year, p.Month });
            // Old read notifications are cleared by date
            modelBuilder.Entity<Notification>().HasIndex(n => new { n.IsRead, n.CreatedAt });

            modelBuilder.Entity<Alert>()
                .HasOne<User>()
                .WithMany()
                .HasForeignKey(a => a.UserID)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}