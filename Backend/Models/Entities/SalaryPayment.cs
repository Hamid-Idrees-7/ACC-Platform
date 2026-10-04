using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Backend.Models.Entities
{
    // One payment towards a pay line in one month. A line can be paid in parts, any time:
    // what is due is what was earned so far minus what was paid.
    // Daily/Contract lines are per assignment (per project); Monthly is one per employee
    // per month (a monthly salary is owed by the company, not tied to a project).
    // Undoing a payment deletes the row, so that amount is due again.
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

        // Set for Daily and Contract (the assignment and its project). Null for Monthly.
        public int? AssignmentID { get; set; }
        public int? ProjectID { get; set; }

        // What the line had earned when this payment was made.
        [Column(TypeName = "decimal(18,2)")]
        public decimal CalculatedAmount { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal PaidAmount { get; set; }

        [MaxLength(255)]
        public string? Note { get; set; }

        public int PaidByUserID { get; set; }
        public DateTime PaidAt { get; set; } = AppTime.Now;

        public DateTime CreatedAt { get; set; } = AppTime.Now;
    }
}
