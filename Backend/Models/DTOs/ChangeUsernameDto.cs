using System.ComponentModel.DataAnnotations;

namespace Backend.Models.DTOs
{
    // Changing the username needs the current password again.
    public class ChangeUsernameDto
    {
        [Required]
        public string CurrentPassword { get; set; } = string.Empty;

        [Required]
        [MaxLength(50)]
        public string NewUsername { get; set; } = string.Empty;
    }
}