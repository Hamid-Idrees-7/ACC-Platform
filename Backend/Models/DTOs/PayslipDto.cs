namespace Backend.Models.DTOs
{
    // A printable payslip for one employee for one month.
    public class PayslipDto
    {
        // Letterhead and currency from Settings > Company
        public CompanyBrandDto Company { get; set; } = new();
        public int Year { get; set; }
        public int Month { get; set; }
        public string PeriodLabel { get; set; } = string.Empty;   // eg July 2026

        public int EmployeeID { get; set; }
        public string EmployeeName { get; set; } = string.Empty;
        public string Designation { get; set; } = string.Empty;
        public string? CNIC { get; set; }
        public string? Phone { get; set; }
        public string Status { get; set; } = "Pending";

        public List<SalaryLineDto> Lines { get; set; } = new();
        public decimal TotalCalculated { get; set; }
        public decimal TotalPaid { get; set; }
        public decimal TotalDue { get; set; }
        public DateTime GeneratedAt { get; set; }
    }
}
