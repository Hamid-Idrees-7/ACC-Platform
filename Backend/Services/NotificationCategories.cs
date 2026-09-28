namespace Backend.Services
{
    public static class NotificationCategories
    {
        public const string Login = "Login";
        public const string Security = "Security";
        public const string Approval = "Approval";
        public const string MaterialRequests = "Material Requests";
        public const string Client = "Client";
        public const string Employee = "Employee";
        public const string Material = "Material";
        public const string Project = "Project";
        public const string Assignment = "Assignment";
        public const string Expense = "Expense";
        public const string Billing = "Billing";
        public const string Salary = "Salary";
        public const string Message = "Message";

        public static readonly string[] Mutable =
        {
            Login, Approval, MaterialRequests, Message, Client, Employee, Material, Project, Assignment, Expense, Billing, Salary
        };

        public static string? Canonical(string? category) =>
            Mutable.FirstOrDefault(c => string.Equals(c, category?.Trim(), StringComparison.OrdinalIgnoreCase));

        public static List<string> Parse(string? stored) =>
            string.IsNullOrWhiteSpace(stored)
                ? new List<string>()
                : stored.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                    .Select(Canonical)
                    .Where(c => c != null)
                    .Select(c => c!)
                    .Distinct()
                    .ToList();

        public static bool IsMuted(string? stored, string category) =>
            Canonical(category) is { } key && Parse(stored).Contains(key);
    }
}
