using System.ComponentModel.DataAnnotations;

namespace Backend.Models.DTOs
{
    // Sent when creating or updating a client.
    public class ClientDto
    {
        [Required]
        [MaxLength(50)]
        public string FullName { get; set; } = string.Empty;

        [MaxLength(100)]
        [EmailAddress]
        public string? Email { get; set; }

        [Required]
        [MaxLength(15)]
        public string Phone { get; set; } = string.Empty;

        [MaxLength(15)]
        public string? SecondaryPhone { get; set; }

        [Required]
        [MaxLength(15)]
        public string CNIC { get; set; } = string.Empty;

        [MaxLength(255)]
        public string? Address { get; set; }

        [MaxLength(50)]
        public string? City { get; set; }

        [Required]
        [MaxLength(20)]
        public string ClientType { get; set; } = "External";

        [Required]
        [MaxLength(20)]
        public string Status { get; set; } = "Active";
    }
}