namespace Backend.Services
{
    public static class NotificationLinks
    {
        public const string Security = "/dashboard/settings?tab=security";
        public const string MyRequests = "/dashboard/field";

        public static string Approval(int pendingActionId) => $"/dashboard/approvals?highlight={pendingActionId}";
        public static string MaterialRequest(int requestId) => $"/dashboard/material-requests?highlight={requestId}";
        public static string Client(int id) => $"/dashboard/clients?highlight={id}";
        public static string Employee(int id) => $"/dashboard/employees?highlight={id}";
        public static string Material(int id) => $"/dashboard/materials?highlight={id}";
        public static string MaterialHistory(int id) => $"/dashboard/materials/{id}/history";
        public static string Assignment(int id) => $"/dashboard/assignments?highlight={id}";
        public static string Project(int id) => $"/dashboard/projects/{id}";
        public static string Billing(int projectId) => $"/dashboard/billing/project/{projectId}";
        public static string Invoice(int projectId, int invoiceId) => $"/dashboard/billing/project/{projectId}?highlight={invoiceId}";
        public static string Salaries(int year, int month) => $"/dashboard/salaries?year={year}&month={month}";
        public const string Messages = "/dashboard/queries";

        public static string? ForModule(string module, int id) => module switch
        {
            "Clients" => Client(id),
            "Employees" => Employee(id),
            "Materials" => Material(id),
            "Projects" => Project(id),
            "Assignments" => Assignment(id),
            _ => null
        };
    }
}
