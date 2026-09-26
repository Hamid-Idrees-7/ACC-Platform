using System.ComponentModel.DataAnnotations;

namespace Backend.Models.DTOs
{
    // Incoming data when adding or editing a project expense.
    // The project comes from the route, never from the body.
    public class SaveProjectExpenseDto
    {
        [Required]
        [MaxLength(50)]
        public string Category { get; set; } = string.Empty;

        [Required]
        [MaxLength(200)]
        public string Description { get; set; } = string.Empty;

        public decimal Amount { get; set; }

        public DateTime ExpenseDate { get; set; }

        public int? PhaseID { get; set; }

        [MaxLength(100)]
        public string? PaidTo { get; set; }

        [MaxLength(60)]
        public string? Reference { get; set; }

        public bool IsRecoverable { get; set; }
    }

    // One expense as shown on the project page.
    public class ProjectExpenseDto
    {
        public int ExpenseID { get; set; }
        public int ProjectID { get; set; }
        public int? PhaseID { get; set; }
        public string PhaseName { get; set; } = "General";
        public string Category { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public decimal Amount { get; set; }
        public DateTime ExpenseDate { get; set; }
        public string? PaidTo { get; set; }
        public string? Reference { get; set; }
        public bool IsRecoverable { get; set; }

        // Set when a recoverable expense has been billed to the client.
        public int? InvoiceID { get; set; }
        public string? InvoiceNumber { get; set; }
        public bool IsInvoiced => InvoiceID.HasValue;

        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
    }

    // The expenses section of a project: every expense plus server-computed totals.
    public class ProjectExpensesDto
    {
        public int ProjectID { get; set; }
        public string ProjectTitle { get; set; } = string.Empty;

        public decimal CompanyTotal { get; set; }         // non-recoverable: part of project cost
        public decimal RecoverableTotal { get; set; }     // paid on the client's behalf
        public decimal RecoverableInvoiced { get; set; }  // already billed back to the client
        public decimal RecoverablePending { get; set; }   // still to bill

        public List<ProjectExpenseDto> Items { get; set; } = new();
        public List<SliceDto> ByCategory { get; set; } = new();   // company cost per category
        public List<string> Categories { get; set; } = new();     // the fixed category list
        public List<PhaseOptionDto> Phases { get; set; } = new();
    }

    // A recoverable expense that has not been billed yet — offered in the invoice form.
    public class PendingReimbursementDto
    {
        public int ExpenseID { get; set; }
        public string Category { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public decimal Amount { get; set; }
        public DateTime ExpenseDate { get; set; }
        public int? PhaseID { get; set; }
    }
}
