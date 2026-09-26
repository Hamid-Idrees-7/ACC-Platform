using Backend.Data;
using Backend.Models.Entities;

namespace Backend.Demo
{
    // Fills a brand-new visitor database with the demo company, Anonymous Construction Co.
    // Everything here is fictional sample data. Dates are always relative to today, so the
    // demo looks current no matter when it is opened.
    //
    // Current contents: the three demo logins and their access. Business data (clients,
    // employees, materials, projects, attendance, payroll, billing) is added module by module.
    public static class DemoSeeder
    {
        public const string AdminUsername = "demo.admin";
        public const string ManagerUsername = "demo.manager";
        public const string EngineerUsername = "demo.engineer";

        // The three built-in demo logins (used by the role switcher). Their username, password,
        // role and status stay fixed; their access can still be changed in Control Unit.
        public static bool IsBuiltInLogin(string? username) =>
            username == AdminUsername || username == ManagerUsername || username == EngineerUsername;

        public static async Task SeedAsync(AppDbContext db, CancellationToken ct = default)
        {
            var now = DateTime.Now;

            var admin = NewUser(AdminUsername, "Visitor Admin", "visitor.admin@acc.example", "Admin",
                "Demo account with full access to every module, approvals and access control.", now.AddMonths(-14));
            var manager = NewUser(ManagerUsername, "Visitor Manager", "visitor.manager@acc.example", "Manager",
                "Demo account that runs projects, stock and teams.", now.AddMonths(-11));
            var engineer = NewUser(EngineerUsername, "Visitor Site Engineer", "visitor.engineer@acc.example", "Site Engineer",
                "Demo account that works on site through Field View.", now.AddMonths(-7));

            db.Users.AddRange(admin, manager, engineer);
            await db.SaveChangesAsync(ct);

            db.UserPermissions.AddRange(ManagerPermissions(manager.UserID, now));
            db.UserPermissions.AddRange(EngineerPermissions(engineer.UserID, now));
            await db.SaveChangesAsync(ct);
        }

        private static User NewUser(string username, string fullName, string email, string role, string bio, DateTime createdAt) => new()
        {
            Username = username,
            FullName = fullName,
            Email = email,             // .example is a reserved domain, so it can never reach a real inbox
            Role = role,
            Bio = bio,
            // Demo logins never sign in with a password; this hash matches nothing anyone can type.
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(Guid.NewGuid().ToString("N")),
            IsActive = true,
            CreatedAt = createdAt,
            UpdatedAt = createdAt
        };

        // The Manager runs day-to-day operations. Together with Admin and Site Engineer this shows
        // all three access levels: full (operations), view-only (Billing, Reports) and none
        // (Salaries, Messages, Users, Control Unit, Approvals).
        // Deletes go through Admin approval, so a visitor can follow the approval workflow end to
        // end by switching between Manager and Admin.
        private static List<UserPermission> ManagerPermissions(int userId, DateTime now)
        {
            var list = new List<UserPermission>();

            // Full operations access
            list.AddRange(Allow(userId, now, "Clients", "View", "Add", "Edit"));
            list.Add(ApprovalNeeded(userId, now, "Clients", "Delete"));
            list.AddRange(Allow(userId, now, "Employees", "View", "Add", "Edit"));
            list.Add(ApprovalNeeded(userId, now, "Employees", "Delete"));
            list.AddRange(Allow(userId, now, "Materials", "View", "Add", "Edit", "Manage"));
            list.Add(ApprovalNeeded(userId, now, "Materials", "Delete"));
            list.AddRange(Allow(userId, now, "Projects", "View", "Add", "Edit", "Manage"));
            list.Add(ApprovalNeeded(userId, now, "Projects", "Delete"));
            list.AddRange(Allow(userId, now, "Expenses", "View", "Add", "Edit"));
            list.Add(ApprovalNeeded(userId, now, "Expenses", "Delete"));
            list.AddRange(Allow(userId, now, "Assignments", "View", "Add", "Edit"));
            list.Add(ApprovalNeeded(userId, now, "Assignments", "Delete"));
            list.AddRange(Allow(userId, now, "Attendance", "View", "Mark"));

            // Approves / rejects the Site Engineer's material requests (Admin can too)
            list.AddRange(Allow(userId, now, "MaterialRequests", "View", "Manage"));

            // View only
            list.AddRange(Allow(userId, now, "Billing", "View"));
            list.AddRange(Allow(userId, now, "Reports", "View"));

            // No access: Salaries (payroll stays private), Messages, Users, Control Unit, Approvals
            return list;
        }

        // The Site Engineer only works inside Field View, scoped to their own site.
        private static List<UserPermission> EngineerPermissions(int userId, DateTime now) =>
            Allow(userId, now, "Field", "View", "Manage").ToList();

        private static IEnumerable<UserPermission> Allow(int userId, DateTime now, string module, params string[] actions) =>
            actions.Select(action => new UserPermission
            {
                UserID = userId,
                Module = module,
                Action = action,
                IsAllowed = true,
                RequiresApproval = false,
                UpdatedAt = now
            });

        private static UserPermission ApprovalNeeded(int userId, DateTime now, string module, string action) => new()
        {
            UserID = userId,
            Module = module,
            Action = action,
            IsAllowed = true,
            RequiresApproval = true,
            UpdatedAt = now
        };
    }
}
