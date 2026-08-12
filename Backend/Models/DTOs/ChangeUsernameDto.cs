using System.ComponentModel.DataAnnotations;

namespace Backend.Models.DTOs
{
    // Used to change username - requires the current password (re-authentication)
    public class ChangeUsernameDto
    {
        [Required]
        public string CurrentPassword { get; set; } = string.Empty;

        [Required]
        [MaxLength(50)]
        public string NewUsername { get; set; } = string.Empty;
    }
}