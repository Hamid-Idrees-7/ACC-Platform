using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Backend.Models.Entities
{
    // One billed line on an invoice. Amount = Quantity x Rate. Optionally tied to a
    // project phase (milestone billing) — but the amount is the client price, not cost.
    public class InvoiceItem
    {
        [Key]
        public int ItemID { get; set; }

        [Required]
        public int InvoiceID { get; set; }

        [Required]
        [MaxLength(200)]
        public string Description { get; set; } = string.Empty;

        [Column(TypeName = "decimal(18,2)")]
        public decimal Quantity { get; set; } = 1;

        [Column(TypeName = "decimal(18,2)")]
        public decimal Rate { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal Amount { get; set; }

        // Optional link to the project phase this line bills for.
        public int? PhaseID { get; set; }
    }
}
