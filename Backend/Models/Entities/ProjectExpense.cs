using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Backend.Models.Entities
{
    // A one-off cost paid for a project that is not a material or labour cost:
    // plot fees, transfer and registry fees, taxes, possession charges, approvals and so on.
    //
    // IsRecoverable splits these into two kinds:
    //   false = a company cost. It is added to the project's actual cost and lowers profit.
    //   true  = paid on the client's behalf. It is billed back to the client through an
    //           invoice line, so it does not change profit (money out, same money back in).
    public class ProjectExpense
    {
        [Key]
        public int ExpenseID { get; set; }

        [Required]
        public int ProjectID { get; set; }

        // Optional phase the cost belongs to. Kept as a plain value (like material issues),
        // so deleting a phase simply shows the expense as "General".
        public int? PhaseID { get; set; }

        // One of ExpenseCategories.All
        [Required]
        [MaxLength(50)]
        public string Category { get; set; } = string.Empty;

        [Required]
        [MaxLength(200)]
        public string Description { get; set; } = string.Empty;

        [Column(TypeName = "decimal(18,2)")]
        public decimal Amount { get; set; }

        public DateTime ExpenseDate { get; set; }

        // Who was paid (e.g. "LDA", "FBR", "Society office"). Optional.
        [MaxLength(100)]
        public string? PaidTo { get; set; }

        // Challan / receipt / cheque number, so the payment can be traced. Optional.
        [MaxLength(60)]
        public string? Reference { get; set; }

        public bool IsRecoverable { get; set; }

        public int CreatedByUserID { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.Now;
        public DateTime UpdatedAt { get; set; } = DateTime.Now;
    }
}
