using System.ComponentModel.DataAnnotations;

namespace Backend.Models.Entities
{
    // A notification shown to a specific user.
    // Personal notifications go to the user who acted; activity notifications
    // (for admins) record what other users did.
    public class Notification
    {
        [Key]
        public int NotificationID { get; set; }

        // Who this notification is for (whose bell it appears in)
        [Required]
        public int UserID { get; set; }

        // Personal = the user's own activity / approval updates
        // Activity = another user's action, recorded for an admin
        [Required]
        [MaxLength(20)]
        public string Type { get; set; } = "Personal";

        // Category for the icon/colour, e.g. "Login", "Client", "Employee", "Approval"
        [MaxLength(30)]
        public string Category { get; set; } = "General";

        [Required]
        [MaxLength(150)]
        public string Title { get; set; } = string.Empty;

        [Required]
        [MaxLength(400)]
        public string Message { get; set; } = string.Empty;

        // Optional reason (e.g. an admin's note when approving/rejecting)
        [MaxLength(300)]
        public string? Reason { get; set; }

        public bool IsRead { get; set; } = false;

        public DateTime CreatedAt { get; set; } = DateTime.Now;
    }
}