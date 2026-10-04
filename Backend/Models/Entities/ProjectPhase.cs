using System.ComponentModel.DataAnnotations;

namespace Backend.Models.Entities
{
    public class ProjectPhase
    {
        [Key]
        public int PhaseID { get; set; }

        [Required]
        public int ProjectID { get; set; }
        public Project? Project { get; set; }

        [Required]
        [MaxLength(100)]
        public string Name { get; set; } = string.Empty;

        // Display order, set by drag and drop on the detail page
        public int OrderNo { get; set; }

        // Pending, In Progress, Completed
        [Required]
        [MaxLength(20)]
        public string Status { get; set; } = "Pending";

        // Completion percentage, 0 to 100
        public int Progress { get; set; }

        public DateTime CreatedAt { get; set; } = AppTime.Now;

        public DateTime? UpdatedAt { get; set; }
    }
}
