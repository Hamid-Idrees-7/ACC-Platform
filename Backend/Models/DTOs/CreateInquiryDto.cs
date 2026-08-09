using System.ComponentModel.DataAnnotations;

namespace Backend.Models.DTOs
{
    public class CreateInquiryDto
    {
        [Required]
        [MaxLength(50)]
        public string Name { get; set; } = string.Empty;

        [Required]
        [MaxLength(15)]
        public string Phone { get; set; } = string.Empty;

        [MaxLength(50)]
        public string? Email { get; set; }

        [MaxLength(50)]
        public string? Service { get; set; }

        [Required]
        [MaxLength(500)]
        public string Message { get; set; } = string.Empty;

        // Honeypot: bots fill this hidden field, humans don't
        public string? Website { get; set; }
    }
}