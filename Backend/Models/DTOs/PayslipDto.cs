namespace Backend.Models.DTOs
{
    // A printable payslip for one employee for one month.
    public class PayslipDto
    {
        public string CompanyName { get; set; } = "Anonymous Construction & Co.";
        public int Year { get; set; }
        public int Month { get; set; }
        public string PeriodLabel { get; set; } = string.Empty;   // July 2026

        public int EmployeeID { get; set; }
        public string EmployeeName { get; set; } = string.Empty;
        public string Designation { get; set; } = string.Empty;
        public string? CNIC { get; set; }
        public string? Phone { get; set; }
        public string Status { get; set; } = "Pending";

        public List<SalaryLineDto> Lines { get; set; } = new();
        public decimal TotalCalculated { get; set; }
        public decimal NetPaid { get; set; }   // net payable/paid: paid amount where paid, else calculated
        public DateTime GeneratedAt { get; set; }
    }
}
