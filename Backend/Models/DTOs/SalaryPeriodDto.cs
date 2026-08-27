namespace Backend.Models.DTOs
{
    // One month of payroll: top stats plus a card per employee.
    public class SalaryPeriodDto
    {
        public int Year { get; set; }
        public int Month { get; set; }

        public decimal TotalPayroll { get; set; }
        public decimal Paid { get; set; }
        public decimal Pending { get; set; }
        public int WorkersCount { get; set; }

        public List<EmployeeSalaryDto> Employees { get; set; } = new();
    }

    // One employee's payroll card for the month.
    public class EmployeeSalaryDto
    {
        public int EmployeeID { get; set; }
        public string EmployeeName { get; set; } = string.Empty;
        public string Designation { get; set; } = string.Empty;
        public string Status { get; set; } = "Pending";   // Pending / Partial / Paid
        public decimal Total { get; set; }
        public List<SalaryLineDto> Lines { get; set; } = new();
    }

    // One payable line: a monthly salary, or a daily/contract line for a project.
    public class SalaryLineDto
    {
        public string SourceType { get; set; } = string.Empty;   // Daily / Contract / Monthly
        public int? AssignmentID { get; set; }
        public int? ProjectID { get; set; }
        public string ProjectName { get; set; } = string.Empty;   //  for Monthly (company payroll)

        public decimal Rate { get; set; }        // per-day rate, monthly salary, or contract amount
        public int PresentDays { get; set; }     // daily only
        public int AbsentDays { get; set; }       // daily only
        public decimal CalculatedAmount { get; set; }

        public bool IsPaid { get; set; }
        public decimal PaidAmount { get; set; }
        public string? Note { get; set; }
        public int? PaymentID { get; set; }       // used to undo the payment
    }
}
