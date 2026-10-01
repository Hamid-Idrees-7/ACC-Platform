using System.ComponentModel.DataAnnotations;

namespace Backend.Models.DTOs
{
    public class ChangePasswordDto
    {
        [Required]
        public string CurrentPassword { get; set; } = string.Empty;

        // PasswordPolicy checks the password rules (length, letters and numbers).
        [Required]
        public string NewPassword { get; set; } = string.Empty;
    }
}