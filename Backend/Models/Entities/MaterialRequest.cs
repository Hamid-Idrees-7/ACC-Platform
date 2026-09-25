using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Backend.Models.Entities
{
    // A site engineer's request for material on their project. It sits Pending until an
    // admin/store approves it (which issues the stock) or rejects it. The engineer can
    // never issue stock directly — this request→approval step protects the inventory.
    public class MaterialRequest
    {
        [Key]
        public int RequestID { get; set; }

        [Required]
        public int ProjectID { get; set; }

        public int? PhaseID { get; set; }

        [Required]
        public int MaterialID { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal Quantity { get; set; }

        [MaxLength(255)]
        public string? Note { get; set; }

        // The user (site engineer) who raised the request.
        [Required]
        public int RequestedByUserID { get; set; }

        // pending / approved / rejected
        [Required]
        [MaxLength(20)]
        public string Status { get; set; } = "Pending";

        // Who resolved it, an optional note (reason for rejection), and when.
        public int? ResolvedByUserID { get; set; }

        [MaxLength(255)]
        public string? ResolveNote { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.Now;
        public DateTime? ResolvedAt { get; set; }
    }
}
