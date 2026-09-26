namespace Backend.Models.DTOs
{
    // A user's display settings, sent both ways (read and save).
    public class PreferencesDto
    {
        public string Theme { get; set; } = string.Empty;
        public string NumberFormat { get; set; } = string.Empty;
        public string DateFormat { get; set; } = string.Empty;
        public string TimeFormat { get; set; } = string.Empty;
    }
}
