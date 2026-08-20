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

        // Restock (stock in) or Issue (stock out)
        [Required]
        [MaxLength(20)]
        public string Type { get; set; } = string.Empty;

        [Column(TypeName = "decimal(18,2)")]
        public decimal Quantity { get; set; }

        // Per-unit price captured at the time of the transaction,
        // cost stays correct even after prices change.
        [Column(TypeName = "decimal(18,2)")]
        public decimal Rate { get; set; }

        // Destination project for issues, plain text until the Projects module exists.
        [MaxLength(100)]
        public string? ProjectName { get; set; }

        [MaxLength(255)]
        public string? Note { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.Now;
    }
}
