using Backend.Models.DTOs;
using Backend.Models.Entities;

namespace Backend.Alerts
{
    public class AlertFacts
    {
        public DateTime Now { get; set; } = DateTime.Now;
        public List<Project> Projects { get; set; } = new();
        public List<ProjectPhase> Phases { get; set; } = new();
        public List<ProjectExpense> Expenses { get; set; } = new();
        public List<Invoice> Invoices { get; set; } = new();
        public List<InvoiceItem> InvoiceItems { get; set; } = new();
        public List<InvoicePayment> InvoicePayments { get; set; } = new();
        public List<Material> Materials { get; set; } = new();
        public List<MaterialTransaction> MaterialTransactions { get; set; } = new();
        public List<MaterialRequest> PendingMaterialRequests { get; set; } = new();
        public List<PendingAction> PendingApprovals { get; set; } = new();
        public List<Inquiry> UnreadInquiries { get; set; } = new();
        public List<Assignment> Assignments { get; set; } = new();
        public List<Attendance> Attendance { get; set; } = new();
        public Dictionary<int, int> PresentDays { get; set; } = new();
        public List<Employee> Employees { get; set; } = new();
        public List<CompanyHoliday> Holidays { get; set; } = new();
        public List<string> WeeklyOffDays { get; set; } = new();
        public List<SalaryPeriodDto> SalaryPeriods { get; set; } = new();
    }
}
