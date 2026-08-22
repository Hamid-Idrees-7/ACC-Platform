using System.ComponentModel.DataAnnotations;

namespace Backend.Models.DTOs
{
    public class IssueDto
    {
        [Required]
        [MaxLength(100)]
        public string ProjectName { get; set; } = string.Empty;

        // The real project this stock is issued to, and optionally its phase.
        public int? ProjectID { get; set; }
        public int? PhaseID { get; set; }

        public decimal Quantity { get; set; }

        // No rate here: an issue is costed automatically at the material's
        // weighted average cost at the moment it happens (locked on save).
        [MaxLength(255)]
        public string? Note { get; set; }
    }
}
