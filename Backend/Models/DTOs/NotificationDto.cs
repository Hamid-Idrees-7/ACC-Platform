namespace Backend.Models.DTOs
{
    // A notification sent OUT to the frontend
    public class NotificationDto
    {
        public int NotificationID { get; set; }
        public int UserID { get; set; }
        public string Type { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public string? Reason { get; set; }
        public bool IsRead { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}