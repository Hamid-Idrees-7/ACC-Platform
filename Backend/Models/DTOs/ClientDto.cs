using System.ComponentModel.DataAnnotations;

namespace Backend.Models.DTOs
{
    // Used when creating or updating a client (data coming IN from the user).
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