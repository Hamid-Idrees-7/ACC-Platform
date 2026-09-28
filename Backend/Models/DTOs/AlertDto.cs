namespace Backend.Models.DTOs
{
    public class AlertDto
    {
        public int AlertID { get; set; }
        public string Type { get; set; } = string.Empty;
        public string Group { get; set; } = string.Empty;
        public string Severity { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public string? Link { get; set; }
        public string Status { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        public DateTime? ResolvedAt { get; set; }
        public bool CanResolve { get; set; }
    }

    public class AlertSummaryDto
    {
        public int Open { get; set; }
        public int Critical { get; set; }
        public int LatestId { get; set; }
    }

    public class AlertRuleDto
    {
        public string Type { get; set; } = string.Empty;
        public string Group { get; set; } = string.Empty;
        public string Label { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string Severity { get; set; } = string.Empty;
        public string Audience { get; set; } = string.Empty;
        public bool Enabled { get; set; }
        public int? Threshold { get; set; }
        public int? DefaultThreshold { get; set; }
        public string? ThresholdLabel { get; set; }
        public string? Unit { get; set; }
        public int? Min { get; set; }
        public int? Max { get; set; }
    }

    public class SaveAlertRuleDto
    {
        public bool Enabled { get; set; }
        public int? Threshold { get; set; }
    }
}
