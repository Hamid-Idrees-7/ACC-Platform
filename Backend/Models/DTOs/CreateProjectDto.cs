using System.ComponentModel.DataAnnotations;

namespace Backend.Models.DTOs
{
    public class CreateProjectDto
    {
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

        public decimal Budget { get; set; }

        // Only used on create: seed the standard construction phases
        public bool CreateStandardPhases { get; set; }
    }
}
