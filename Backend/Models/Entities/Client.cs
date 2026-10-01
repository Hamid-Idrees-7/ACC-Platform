using System.ComponentModel.DataAnnotations;

namespace Backend.Models.Entities
{
    // A client (the Clients table).
    public class Client
    {
        [Key]
        public int ClientID { get; set; }

        [Required]
        [MaxLength(50)]
        public string FullName { get; set; } = string.Empty;

        [MaxLength(100)]
        public string? Email { get; set; }

        [Required]
        [MaxLength(15)]
        public string Phone { get; set; } = string.Empty;

        [MaxLength(15)]
        public string? SecondaryPhone { get; set; }

        // CNIC (Pakistani national ID card number), 13 digits
        [Required]
        [MaxLength(15)]
        public string CNIC { get; set; } = string.Empty;

        [MaxLength(255)]
        public string? Address { get; set; }

        [MaxLength(50)]
        public string? City { get; set; }

        // External (a paying customer) or Internal
        [Required]
        [MaxLength(20)]
        public string ClientType { get; set; } = "External";


        // Active or Inactive
        [Required]
        [MaxLength(20)]
        public string Status { get; set; } = "Active";

        public DateTime CreatedAt { get; set; } = DateTime.Now;

        public DateTime UpdatedAt { get; set; } = DateTime.Now;
    }
}