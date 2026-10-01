using System.ComponentModel.DataAnnotations;

namespace Backend.Models.Entities
{
    // A "forgot password" link sent by email. Only a hash of the link's code is stored,
    // so the table alone can't be used to reset anyone's password. Times are UTC.
    public class PasswordReset
    {
        [Key]
        public int PasswordResetID { get; set; }

        public int UserID { get; set; }

        // SHA-256 of the code in the link, as hex.
        [Required]
        [MaxLength(64)]
        public string CodeHash { get; set; } = string.Empty;

        public DateTime CreatedAt { get; set; }
        public DateTime ExpiresAt { get; set; }

        // Set when the link is used. A link works once.
        public DateTime? UsedAt { get; set; }

        [MaxLength(45)]
        public string? RequestedFromIp { get; set; }
    }
}
