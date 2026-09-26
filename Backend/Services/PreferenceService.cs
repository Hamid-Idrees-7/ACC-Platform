using Backend.Models.DTOs;
using Backend.Models.Entities;
using Backend.Repositories;

namespace Backend.Services
{
    // Settings > Appearance: theme, number format, date format and time format.
    public class PreferenceService : IPreferenceService
    {
        private readonly IPreferenceRepository _repository;

        public PreferenceService(IPreferenceRepository repository)
        {
            _repository = repository;
        }

        public async Task<PreferencesDto> GetAsync(int userId)
        {
            var saved = await _repository.GetAsync(userId);
            return saved == null ? Defaults() : ToDto(saved);
        }

        public async Task<(PreferencesDto? Saved, string? Error)> SaveAsync(int userId, PreferencesDto dto)
        {
            var theme = Pick(dto.Theme, PreferenceOptions.Themes);
            if (theme == null) return (null, "Choose Light, Dark or System.");

            var numberFormat = Pick(dto.NumberFormat, PreferenceOptions.NumberFormats);
            if (numberFormat == null) return (null, "Choose a number format from the list.");

            var dateFormat = Pick(dto.DateFormat, PreferenceOptions.DateFormats);
            if (dateFormat == null) return (null, "Choose a date format from the list.");

            var timeFormat = Pick(dto.TimeFormat, PreferenceOptions.TimeFormats);
            if (timeFormat == null) return (null, "Choose 12-hour or 24-hour time.");

            var preference = new UserPreference
            {
                UserID = userId,
                Theme = theme,
                NumberFormat = numberFormat,
                DateFormat = dateFormat,
                TimeFormat = timeFormat,
                UpdatedAt = DateTime.Now
            };
            await _repository.SaveAsync(preference);
            return (ToDto(preference), null);
        }

        // Returns the allowed value that matches (case-insensitive), or null.
        private static string? Pick(string? value, string[] allowed)
        {
            if (string.IsNullOrWhiteSpace(value)) return null;
            var trimmed = value.Trim();
            return allowed.FirstOrDefault(a => string.Equals(a, trimmed, StringComparison.OrdinalIgnoreCase));
        }

        private static PreferencesDto Defaults() => new()
        {
            Theme = PreferenceOptions.DefaultTheme,
            NumberFormat = PreferenceOptions.DefaultNumberFormat,
            DateFormat = PreferenceOptions.DefaultDateFormat,
            TimeFormat = PreferenceOptions.DefaultTimeFormat
        };

        private static PreferencesDto ToDto(UserPreference p) => new()
        {
            Theme = p.Theme,
            NumberFormat = p.NumberFormat,
            DateFormat = p.DateFormat,
            TimeFormat = p.TimeFormat
        };
    }
}
