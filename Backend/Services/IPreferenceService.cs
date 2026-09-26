using Backend.Models.DTOs;

namespace Backend.Services
{
    public interface IPreferenceService
    {
        // The user's settings, or the defaults when nothing has been saved yet.
        Task<PreferencesDto> GetAsync(int userId);

        // Validates and saves. Returns the saved settings, or an error message.
        Task<(PreferencesDto? Saved, string? Error)> SaveAsync(int userId, PreferencesDto dto);
    }
}
