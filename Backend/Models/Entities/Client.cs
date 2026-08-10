using System.ComponentModel.DataAnnotations;

namespace Backend.Models.Entities
{
    // Represents a client/customer in the system (maps to the "Clients" table)
    public class Client
    {
        // Primary key - unique ID for each client (auto-incremented by the database)
        [Key]
        public int ClientID { get; set; }

        // Client's full name - required, max 100 characters
        [Required]
        [MaxLength(50)]
        public string FullName { get; set; } = string.Empty;

        // Email address - optional, max 100 characters
        [MaxLength(100)]
        public string? Email { get; set; }

        // Primary phone number - required, max 20 characters
        [Required]
        [MaxLength(15)]
        public string Phone { get; set; } = string.Empty;

        // Secondary phone number - optional
        [MaxLength(15)]
        public string? SecondaryPhone { get; set; }

        // CNIC (national ID) - required, 13 digits
        [Required]
        [MaxLength(15)]
        public string CNIC { get; set; } = string.Empty;

        // Physical address - optional
        [MaxLength(255)]
        public string? Address { get; set; }

        // City - optional
        [MaxLength(50)]
        public string? City { get; set; }

        // Client type: "External" (paying customer) or "Internal" - defaults to External
        [Required]
        [MaxLength(20)]
        public string ClientType { get; set; } = "External";


        // Status: "Active" or "Inactive" - defaults to Active
        [Required]
        [MaxLength(20)]
        public string Status { get; set; } = "Active";

        // When this client was created (set automatically)
        public DateTime CreatedAt { get; set; } = DateTime.Now;

        // When this client was last updated (set automatically)
        public DateTime UpdatedAt { get; set; } = DateTime.Now;
    }
}