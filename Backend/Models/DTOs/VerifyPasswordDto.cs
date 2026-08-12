using System.ComponentModel.DataAnnotations;

namespace Backend.Models.DTOs
{
    public class VerifyPasswordDto
    {
        [Required]
        public string Password { get; set; } = string.Empty;
    }
}