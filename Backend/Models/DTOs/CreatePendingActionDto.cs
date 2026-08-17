using System.ComponentModel.DataAnnotations;

namespace Backend.Models.DTOs
{
    // Used when a user requests an action that needs approval
    public class CreatePendingActionDto
    {
        [Required]
        [MaxLength(50)]
        public string Module { get; set; } = string.Empty;

        [Required]
        [MaxLength(30)]
        public string Action { get; set; } = string.Empty;

        [Required]
        public int TargetID { get; set; }

        [MaxLength(150)]
        public string TargetName { get; set; } = string.Empty;
    }
}