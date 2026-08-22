using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Backend.Models.Entities
{
    public class Project
    {
        [Key]
        public int ProjectID { get; set; }

        [Required]
        [MaxLength(100)]
        public string Title { get; set; } = string.Empty;

        [Required]
        public int ClientID { get; set; }

        [Required]
        [MaxLength(50)]
        public string ProjectType { get; set; } = string.Empty;

        [Required]
        [MaxLength(50)]
        public string AreaSize { get; set; } = string.Empty;

        [Required]
        [MaxLength(255)]
        public string Location { get; set; } = string.Empty;

        [MaxLength(500)]
        public string? Description { get; set; }

        public DateTime? StartDate { get; set; }
        public DateTime? ExpectedEndDate { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal Budget { get; set; }

        // In Progress, On Hold, Completed, Cancelled New projects start In Progress
        [Required]
        [MaxLength(20)]
        public string Status { get; set; } = "In Progress";

        public DateTime CreatedAt { get; set; } = DateTime.Now;
        public DateTime UpdatedAt { get; set; } = DateTime.Now;
    }
}
