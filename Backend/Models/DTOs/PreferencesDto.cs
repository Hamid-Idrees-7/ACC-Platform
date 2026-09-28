namespace Backend.Models.DTOs
{
    // A user's display and sign-out settings, sent both ways (read and save).
    public class PreferencesDto
    {
        public string Theme { get; set; } = string.Empty;
        public string NumberFormat { get; set; } = string.Empty;
        public string DateFormat { get; set; } = string.Empty;
        public string TimeFormat { get; set; } = string.Empty;

        // Minutes without activity before automatic sign-out: 0 (off), 15, 30 or 60.
        // Left out when saving = keep the current value.
        public int? IdleMinutes { get; set; }

        public bool? NotificationSound { get; set; }

        public List<string>? MutedCategories { get; set; }
    }
}
