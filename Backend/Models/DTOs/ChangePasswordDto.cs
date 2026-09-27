using System.ComponentModel.DataAnnotations;

namespace Backend.Models.DTOs
{
    public class ChangePasswordDto
    {
        [Required]
        public string CurrentPassword { get; set; } = string.Empty;

        // The password rule (length, letters and numbers...) is checked by PasswordPolicy.
        [Required]
        public string NewPassword { get; set; } = string.Empty;
    }
}