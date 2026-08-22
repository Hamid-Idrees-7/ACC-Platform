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

        // Display order changed by drag-and-drop reordering on the detail page
        public int OrderNo { get; set; }

        // Pending, In Progress, Completed
        [Required]
        [MaxLength(20)]
        public string Status { get; set; } = "Pending";

        // Completion percentage, 0–100
        public int Progress { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.Now;
    }
}
