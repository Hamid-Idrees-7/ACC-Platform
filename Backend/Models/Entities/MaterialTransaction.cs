using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Backend.Models.Entities
{
    public class MaterialTransaction
    {
        [Key]
        public int TransactionID { get; set; }

        [Required]
        public int MaterialID { get; set; }
        public Material? Material { get; set; }

        // "Restock" (stock in) or "Issue" (stock out)
        [Required]
        [MaxLength(20)]
        public string Type { get; set; } = string.Empty;

        [Column(TypeName = "decimal(18,2)")]
        public decimal Quantity { get; set; }

        // Per-unit price captured at the time of the transaction, so historical
        // cost stays correct even after prices change.
        [Column(TypeName = "decimal(18,2)")]
        public decimal Rate { get; set; }

        // Destination project for issues. ProjectName is kept for display/legacy;
        // ProjectID/PhaseID link the issue to a real project and phase for cost rollup.
        [MaxLength(100)]
        public string? ProjectName { get; set; }
        public int? ProjectID { get; set; }
        public int? PhaseID { get; set; }

        [MaxLength(255)]
        public string? Note { get; set; }

        // A cancelled transaction is reversed: it no longer counts toward stock,
        // cost, or totals, but the record is kept for the audit trail.
        public bool IsCancelled { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.Now;
    }
}
