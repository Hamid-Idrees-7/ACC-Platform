using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Backend.Models.Entities
{
    // A client invoice for a project. The client is billed against the project's agreed budget
    // (the price), not the company's costs. Profit is the gap between budget and cost.
    public class Invoice
    {
        [Key]
        public int InvoiceID { get; set; }

        // Built from the prefix in Settings > Company, eg INV-0001
        [Required]
        [MaxLength(20)]
        public string InvoiceNumber { get; set; } = string.Empty;

        [Required]
        public int ProjectID { get; set; }

        public DateTime IssueDate { get; set; }
        public DateTime? DueDate { get; set; }

        // Flat tax added on top of the line-item subtotal (0 if none).
        [Column(TypeName = "decimal(18,2)")]
        public decimal TaxAmount { get; set; }

        [MaxLength(255)]
        public string? Notes { get; set; }

        public DateTime CreatedAt { get; set; } = AppTime.Now;
    }
}
