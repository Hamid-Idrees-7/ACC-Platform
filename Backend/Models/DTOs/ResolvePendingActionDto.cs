using System.ComponentModel.DataAnnotations;

namespace Backend.Models.DTOs
{
    // Used when an admin approves or rejects a pending action
    public class ResolvePendingActionDto
    {
        // Approved or rejected
        [Required]
        [MaxLength(20)]
        public string Status { get; set; } = string.Empty;

        // Optional reason shown to the requester
        [MaxLength(300)]
        public string? Reason { get; set; }
    }
}