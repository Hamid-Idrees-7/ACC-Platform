using Backend.Models.Entities;

namespace Backend.Repositories
{
    public interface ICompanySettingsRepository
    {
        // The saved settings, or null when the admin has not saved them yet.
        Task<CompanySetting?> GetAsync();

        // Creates the single row the first time, updates it afterwards.
        Task SaveAsync(CompanySetting settings);

        // Changes only the weekly off days (Settings > Calendar).
        Task SaveWeeklyOffAsync(string days);
    }
}
