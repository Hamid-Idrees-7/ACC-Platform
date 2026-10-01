using System.ComponentModel.DataAnnotations;

namespace Backend.Models.Entities
{
    // An action (eg a delete) that needs admin approval before it runs.
    public class PendingAction
    {
        [Key]
        public int PendingActionID { get; set; }

        // Who asked
        [Required]
        public int RequestedByUserID { get; set; }

        [Required]
        [MaxLength(100)]
        public string RequestedByName { get; set; } = string.Empty;

        [MaxLength(50)]
        public string RequestedByRole { get; set; } = string.Empty;

        // What was asked for
        [Required]
        [MaxLength(50)]
        public string Module { get; set; } = string.Empty;   // eg Clients

        [Required]
        [MaxLength(30)]
        public string Action { get; set; } = string.Empty;   // eg Delete

        // The record it targets
        [Required]
        public int TargetID { get; set; }                     // eg a ClientID

        [MaxLength(150)]
        public string TargetName { get; set; } = string.Empty; // eg the client's name

        [Required]
        [MaxLength(20)]
        public string Status { get; set; } = "Pending";       // Pending, Approved or Rejected

        // Admin's optional reason when approving or rejecting
        [MaxLength(300)]
        public string? Reason { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.Now;
        public DateTime? ResolvedAt { get; set; }
    }
}