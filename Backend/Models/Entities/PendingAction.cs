using System.ComponentModel.DataAnnotations;

namespace Backend.Models.Entities
{
    // Represents an action (e.g. a delete) that needs admin approval before it runs.
    public class PendingAction
    {
        [Key]
        public int PendingActionID { get; set; }

        // Who requested this action
        [Required]
        public int RequestedByUserID { get; set; }

        [Required]
        [MaxLength(100)]
        public string RequestedByName { get; set; } = string.Empty;

        [MaxLength(50)]
        public string RequestedByRole { get; set; } = string.Empty;

        // What was requested
        [Required]
        [MaxLength(50)]
        public string Module { get; set; } = string.Empty;   // Clients

        [Required]
        [MaxLength(30)]
        public string Action { get; set; } = string.Empty;   // Delete

        // Which record the action targets
        [Required]
        public int TargetID { get; set; }                     // ClientID

        [MaxLength(150)]
        public string TargetName { get; set; } = string.Empty; // Bilal

        // Workflow status
        [Required]
        [MaxLength(20)]
        public string Status { get; set; } = "Pending";       // Pending,Approved,Rejected

        // Admin's optional reason when approving/rejecting
        [MaxLength(300)]
        public string? Reason { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.Now;
        public DateTime? ResolvedAt { get; set; }
    }
}