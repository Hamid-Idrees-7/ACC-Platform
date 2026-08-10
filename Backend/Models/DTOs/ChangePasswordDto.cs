using System.ComponentModel.DataAnnotations;

namespace Backend.Models.DTOs
{
    public class ChangePasswordDto
    {
        [Required]
        public string CurrentPassword { get; set; } = string.Empty;

        [Required]
        [MinLength(5)]
        public string NewPassword { get; set; } = string.Empty;
    }
}