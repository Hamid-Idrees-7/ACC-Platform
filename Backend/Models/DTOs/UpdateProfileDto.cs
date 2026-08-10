using System.ComponentModel.DataAnnotations;

namespace Backend.Models.DTOs
{
    public class UpdateProfileDto
    {
        [Required]
        [MaxLength(100)]
        public string FullName { get; set; } = string.Empty;

        [Required]
        [MaxLength(100)]
        [EmailAddress]
        public string Email { get; set; } = string.Empty;

        [MaxLength(20)]
        public string? Phone { get; set; }

        [MaxLength(20)]
        public string? SecondaryPhone { get; set; }

        [MaxLength(300)]
        public string? Bio { get; set; }
    }
}