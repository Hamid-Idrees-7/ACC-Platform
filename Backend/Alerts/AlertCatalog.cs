using Backend.Models.Entities;

namespace Backend.Alerts
{
    public static class AlertTypes
    {
        public const string BudgetWarning = "budget-warning";
        public const string BudgetOver = "budget-over";
        public const string InvoiceDueSoon = "invoice-due-soon";
        public const string InvoiceOverdue = "invoice-overdue";
        public const string FinalBill = "final-bill";
        public const string UnbilledExpenses = "unbilled-expenses";
        public const string SalaryPending = "salary-pending";
        public const string LowStock = "low-stock";
        public const string OutOfStock = "out-of-stock";
        public const string MaterialRequestPending = "material-request-pending";
        public const string ApprovalPending = "approval-pending";
        public const string InquiryUnread = "inquiry-unread";
        public const string DeadlineNear = "deadline-near";
        public const string ProjectLate = "project-late";
        public const string ReadyToComplete = "ready-to-complete";
        public const string ProjectStalled = "project-stalled";
        public const string AttendanceMissing = "attendance-missing";
        public const string AbsentStreak = "absent-streak";
        public const string AssignmentEnded = "assignment-ended";
        public const string NewDevice = "new-device";
    }

    public static class AlertGroups
    {
        public const string Money = "Money";
        public const string Stock = "Stock and requests";
        public const string Projects = "Projects";
        public const string Team = "Team";
        public const string Security = "Security";

        public static readonly string[] Order = { Money, Stock, Projects, Team, Security };
    }

    public record AlertTypeInfo(
        string Type,
        string Group,
        string Label,
        string Description,
        string Severity,
        string? Module = null,
        string Action = "View",
        bool FieldSites = false,
        bool Personal = false,
        int? DefaultThreshold = null,
        string? ThresholdLabel = null,
        string? Unit = null,
        int? Min = null,
        int? Max = null,
        bool ProjectMoney = false)
    {
        public bool HasThreshold => DefaultThreshold.HasValue;

        public string Audience =>
            Personal ? "Only the account owner"
            : FieldSites ? $"Admins, users with {Module} access, and the site engineers of that project"
            : ProjectMoney ? $"Admins and users with {Module} access who can also see project money"
            : Action == "View" ? $"Admins and users with {Module} access"
            : $"Admins and users who can manage {Module}";
    }

    public static class AlertCatalog
    {
        public static readonly IReadOnlyList<AlertTypeInfo> All = new List<AlertTypeInfo>
        {
            new(AlertTypes.BudgetWarning, AlertGroups.Money, "Budget almost used",
                "A running project's costs (materials, labour and company expenses) reach this share of its budget.",
                AlertSeverities.Warning, "Projects", DefaultThreshold: 80, ThresholdLabel: "Warn at", Unit: "% of budget", Min: 50, Max: 99, ProjectMoney: true),
            new(AlertTypes.BudgetOver, AlertGroups.Money, "Over budget",
                "A running project's costs are more than its budget.",
                AlertSeverities.Critical, "Projects", ProjectMoney: true),
            new(AlertTypes.InvoiceDueSoon, AlertGroups.Money, "Invoice due soon",
                "An invoice is close to its due date and is not fully paid.",
                AlertSeverities.Info, "Billing", DefaultThreshold: 3, ThresholdLabel: "Days before the due date", Unit: "days", Min: 1, Max: 30),
            new(AlertTypes.InvoiceOverdue, AlertGroups.Money, "Invoice overdue",
                "The due date has passed and the invoice is not fully paid.",
                AlertSeverities.Critical, "Billing"),
            new(AlertTypes.FinalBill, AlertGroups.Money, "Final bill pending",
                "A completed project is not fully invoiced, has unbilled expenses, or has a balance to receive.",
                AlertSeverities.Warning, "Billing"),
            new(AlertTypes.UnbilledExpenses, AlertGroups.Money, "Expenses not billed",
                "Recoverable expenses of a running project are not on any invoice after this many days.",
                AlertSeverities.Warning, "Billing", DefaultThreshold: 7, ThresholdLabel: "Not billed after", Unit: "days", Min: 1, Max: 60),
            new(AlertTypes.SalaryPending, AlertGroups.Money, "Salaries not paid",
                "Last month's salaries are not fully paid by this day of the month.",
                AlertSeverities.Warning, "Salaries", DefaultThreshold: 5, ThresholdLabel: "Check on day", Unit: "of the month", Min: 1, Max: 28),

            new(AlertTypes.LowStock, AlertGroups.Stock, "Low stock",
                "A material is at or below its own low-stock level (set on each material).",
                AlertSeverities.Warning, "Materials"),
            new(AlertTypes.OutOfStock, AlertGroups.Stock, "Out of stock",
                "A material has nothing left in stock.",
                AlertSeverities.Critical, "Materials"),
            new(AlertTypes.MaterialRequestPending, AlertGroups.Stock, "Material request waiting",
                "A site material request has had no decision for this long.",
                AlertSeverities.Warning, "MaterialRequests", "Manage", DefaultThreshold: 24, ThresholdLabel: "Waiting longer than", Unit: "hours", Min: 1, Max: 168),
            new(AlertTypes.ApprovalPending, AlertGroups.Stock, "Approval waiting",
                "A request in Approvals has had no decision for this long.",
                AlertSeverities.Warning, "Approvals", "Manage", DefaultThreshold: 24, ThresholdLabel: "Waiting longer than", Unit: "hours", Min: 1, Max: 168),
            new(AlertTypes.InquiryUnread, AlertGroups.Stock, "Website messages not read",
                "Messages from the website contact form are still unread after this long.",
                AlertSeverities.Warning, "Messages", DefaultThreshold: 24, ThresholdLabel: "Unread longer than", Unit: "hours", Min: 1, Max: 168),

            new(AlertTypes.DeadlineNear, AlertGroups.Projects, "Deadline near",
                "A running project's expected end date is this close.",
                AlertSeverities.Warning, "Projects", DefaultThreshold: 7, ThresholdLabel: "Days before the deadline", Unit: "days", Min: 1, Max: 60),
            new(AlertTypes.ProjectLate, AlertGroups.Projects, "Project late",
                "A project's expected end date has passed and it is not completed.",
                AlertSeverities.Critical, "Projects"),
            new(AlertTypes.ReadyToComplete, AlertGroups.Projects, "Ready to complete",
                "Every phase of a running project is at 100% but the project is not marked Completed.",
                AlertSeverities.Info, "Projects"),
            new(AlertTypes.ProjectStalled, AlertGroups.Projects, "No activity",
                "Nothing is recorded on a running project (attendance, expenses, materials, billing or phase progress) for this long.",
                AlertSeverities.Warning, "Projects", DefaultThreshold: 14, ThresholdLabel: "No activity for", Unit: "days", Min: 3, Max: 45),

            new(AlertTypes.AttendanceMissing, AlertGroups.Team, "Attendance not marked",
                "On a working day, a running site still has workers without attendance after this time.",
                AlertSeverities.Warning, "Attendance", FieldSites: true, DefaultThreshold: 18, ThresholdLabel: "Check after", Unit: ":00 (24-hour)", Min: 10, Max: 23),
            new(AlertTypes.AbsentStreak, AlertGroups.Team, "Absent in a row",
                "A worker is marked absent this many times in a row.",
                AlertSeverities.Warning, "Attendance", FieldSites: true, DefaultThreshold: 3, ThresholdLabel: "Absent in a row", Unit: "days", Min: 2, Max: 10),
            new(AlertTypes.AssignmentEnded, AlertGroups.Team, "Assignment past its end date",
                "An assignment's end date has passed but it is still Active.",
                AlertSeverities.Info, "Assignments"),

            new(AlertTypes.NewDevice, AlertGroups.Security, "Sign-in from a new device",
                "Someone signs in to your account from a browser or device it has not used before.",
                AlertSeverities.Warning, Personal: true),
        };

        private static readonly Dictionary<string, AlertTypeInfo> ByType = All.ToDictionary(t => t.Type);

        public static AlertTypeInfo? Get(string? type) =>
            type != null && ByType.TryGetValue(type, out var info) ? info : null;

        public static readonly TimeSpan PersonalAlertLifetime = TimeSpan.FromDays(7);
        public static readonly TimeSpan KeepResolved = TimeSpan.FromDays(30);
    }

    public record AlertRuleSetting(bool Enabled, int? Threshold);

    public class AlertRuleSet
    {
        private readonly Dictionary<string, AlertRuleSetting> _settings;

        public AlertRuleSet(IEnumerable<AlertRule> stored)
        {
            var saved = stored.ToDictionary(r => r.Type);
            _settings = AlertCatalog.All.ToDictionary(t => t.Type, t =>
            {
                saved.TryGetValue(t.Type, out var rule);
                var threshold = t.HasThreshold
                    ? Math.Clamp(rule?.Threshold ?? t.DefaultThreshold!.Value, t.Min ?? int.MinValue, t.Max ?? int.MaxValue)
                    : (int?)null;
                return new AlertRuleSetting(rule?.Enabled ?? true, threshold);
            });
        }

        public bool IsEnabled(string type) => _settings.TryGetValue(type, out var s) && s.Enabled;

        public int Threshold(string type) =>
            _settings.TryGetValue(type, out var s) && s.Threshold.HasValue
                ? s.Threshold.Value
                : AlertCatalog.Get(type)?.DefaultThreshold ?? 0;

        public AlertRuleSetting For(string type) => _settings[type];
    }
}
