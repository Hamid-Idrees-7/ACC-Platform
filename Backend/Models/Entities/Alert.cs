using System.ComponentModel.DataAnnotations;

namespace Backend.Models.Entities
{
    public class Alert
    {
        [Key]
        public int AlertID { get; set; }

        [Required]
        [MaxLength(40)]
        public string Type { get; set; } = string.Empty;

        [Required]
        [MaxLength(120)]
        public string Key { get; set; } = string.Empty;

        [Required]
        [MaxLength(20)]
        public string Severity { get; set; } = AlertSeverities.Warning;

        [Required]
        [MaxLength(150)]
        public string Title { get; set; } = string.Empty;

        [Required]
        [MaxLength(400)]
        public string Message { get; set; } = string.Empty;

        [MaxLength(200)]
        public string? Link { get; set; }

        public int? ProjectID { get; set; }

        public int? UserID { get; set; }

        [Required]
        [MaxLength(20)]
        public string Status { get; set; } = AlertStatuses.Open;

        public DateTime CreatedAt { get; set; } = DateTime.Now;
        public DateTime UpdatedAt { get; set; } = DateTime.Now;
        public DateTime? ResolvedAt { get; set; }
    }

    public class AlertRule
    {
        [Key]
        [MaxLength(40)]
        public string Type { get; set; } = string.Empty;

        public bool Enabled { get; set; } = true;

        public int? Threshold { get; set; }

        public DateTime UpdatedAt { get; set; } = DateTime.Now;

        [MaxLength(100)]
        public string? UpdatedBy { get; set; }
    }

    public static class AlertStatuses
    {
        public const string Open = "Open";
        public const string Resolved = "Resolved";
    }

    public static class AlertSeverities
    {
        public const string Critical = "Critical";
        public const string Warning = "Warning";
        public const string Info = "Info";
    }
}
