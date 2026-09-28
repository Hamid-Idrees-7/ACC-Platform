using Backend.Models.Entities;

namespace Backend.Live
{
    public static class LiveModules
    {
        public const string Alerts = "alerts";
        public const string AlertRules = "alert-rules";

        private static readonly Dictionary<Type, string> Map = new()
        {
            [typeof(Client)] = "clients",
            [typeof(Employee)] = "employees",
            [typeof(User)] = "users",
            [typeof(UserPermission)] = "permissions",
            [typeof(Material)] = "materials",
            [typeof(MaterialTransaction)] = "materials",
            [typeof(Project)] = "projects",
            [typeof(ProjectPhase)] = "projects",
            [typeof(Assignment)] = "assignments",
            [typeof(Attendance)] = "attendance",
            [typeof(SalaryPayment)] = "salaries",
            [typeof(Invoice)] = "billing",
            [typeof(InvoiceItem)] = "billing",
            [typeof(InvoicePayment)] = "billing",
            [typeof(ProjectExpense)] = "expenses",
            [typeof(PendingAction)] = "approvals",
            [typeof(MaterialRequest)] = "material-requests",
            [typeof(Inquiry)] = "messages",
            [typeof(CompanySetting)] = "company",
            [typeof(CompanyHoliday)] = "calendar",
            [typeof(Alert)] = Alerts,
            [typeof(AlertRule)] = AlertRules
        };

        public static string? For(Type entityType) => Map.TryGetValue(entityType, out var module) ? module : null;
    }
}
