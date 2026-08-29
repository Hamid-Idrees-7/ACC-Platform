using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Backend.Models.Entities
{
    // A payment received against an invoice. An invoice can have several (partial) payments;
    // Paid = sum of these, Due = Total - Paid.
    public class InvoicePayment
    {
        [Key]
        public int PaymentID { get; set; }

        [Required]
        public int InvoiceID { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal Amount { get; set; }

        public DateTime PaymentDate { get; set; }

        [Required]
        [MaxLength(30)]
        public string Method { get; set; } = "Cash";

        [MaxLength(255)]
        public string? Reference { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.Now;
    }
}
