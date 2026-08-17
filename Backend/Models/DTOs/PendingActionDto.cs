namespace Backend.Models.DTOs
{
    // Represents a pending action sent OUT to the frontend
    public class PendingActionDto
    {
        public int PendingActionID { get; set; }
        public int RequestedByUserID { get; set; }
        public string RequestedByName { get; set; } = string.Empty;
        public string RequestedByRole { get; set; } = string.Empty;
        public string Module { get; set; } = string.Empty;
        public string Action { get; set; } = string.Empty;
        public int TargetID { get; set; }
        public string TargetName { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public string? Reason { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? ResolvedAt { get; set; }
    }
}