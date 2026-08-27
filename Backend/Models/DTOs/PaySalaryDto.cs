namespace Backend.Models.DTOs
{
    // Pay one line. The server recomputes CalculatedAmount itself — only the final paid
    // amount (which may differ) and an optional note are taken from the client.
    public class PaySalaryDto
    {
        public int EmployeeID { get; set; }
        public int Year { get; set; }
        public int Month { get; set; }
        public string SourceType { get; set; } = string.Empty;   // Daily / Contract / Monthly
        public int? AssignmentID { get; set; }                   // null for monthly
        public decimal PaidAmount { get; set; }
        public string? Note { get; set; }
    }
}
