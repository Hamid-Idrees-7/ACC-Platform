using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Backend.Models.Entities
{
    // A single salary payment for one pay line, in one month.
    // Daily/Contract lines are per assignment (per project); Monthly is one per employee
    // per month (a monthly salary is owed by the company, not tied to a project).
    // A row means paid. Undoing a payment simply deletes the row — back to Pending.
    public class SalaryPayment
    {
        [Key]
        public int PaymentID { get; set; }

        [Required]
        public int EmployeeID { get; set; }

        // Pay period
        public int Year { get; set; }
        public int Month { get; set; }

        // Daily, Contract or Monthly
        [Required]
        [MaxLength(20)]
        public string SourceType { get; set; } = string.Empty;

        // Set for Daily/Contract (the specific assignment + project). Null for Monthly.
        public int? AssignmentID { get; set; }
        public int? ProjectID { get; set; }

        // What the system worked out, kept alongside the actual paid amount so any
        // override (paid different from calculated) is always visible on the payslip.
        [Column(TypeName = "decimal(18,2)")]
        public decimal CalculatedAmount { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal PaidAmount { get; set; }

        [MaxLength(255)]
        public string? Note { get; set; }

        public int PaidByUserID { get; set; }
        public DateTime PaidAt { get; set; } = DateTime.Now;

        public DateTime CreatedAt { get; set; } = DateTime.Now;
    }
}
