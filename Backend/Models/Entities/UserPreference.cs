using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Backend.Models.Entities
{
    // Personal display settings of one user (Settings > Appearance). Stored on the server
    // so they follow the user to every device. One row per user; a user without a row
    // simply gets the defaults.
    public class UserPreference
    {
        // Same value as the user's ID (one-to-one with Users).
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.None)]
        public int UserID { get; set; }

        // light, dark or system (follow the device)
        [Required]
        [MaxLength(10)]
        public string Theme { get; set; } = PreferenceOptions.DefaultTheme;

        // pk (Lac / Crore) or intl (Thousand / Million)
        [Required]
        [MaxLength(10)]
        public string NumberFormat { get; set; } = PreferenceOptions.DefaultNumberFormat;

        // dmy-text, dmy-numeric, mdy-text or iso
        [Required]
        [MaxLength(15)]
        public string DateFormat { get; set; } = PreferenceOptions.DefaultDateFormat;

        // 12h or 24h
        [Required]
        [MaxLength(5)]
        public string TimeFormat { get; set; } = PreferenceOptions.DefaultTimeFormat;

        public DateTime UpdatedAt { get; set; } = DateTime.Now;
    }

    // The allowed values for each preference, shared by validation and defaults.
    public static class PreferenceOptions
    {
        public const string DefaultTheme = "light";
        public const string DefaultNumberFormat = "pk";
        public const string DefaultDateFormat = "dmy-text";
        public const string DefaultTimeFormat = "12h";

        public static readonly string[] Themes = { "light", "dark", "system" };
        public static readonly string[] NumberFormats = { "pk", "intl" };
        public static readonly string[] DateFormats = { "dmy-text", "dmy-numeric", "mdy-text", "iso" };
        public static readonly string[] TimeFormats = { "12h", "24h" };
    }
}
