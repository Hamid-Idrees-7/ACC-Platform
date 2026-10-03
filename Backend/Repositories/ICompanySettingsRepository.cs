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

        // Takes the next invoice number (at least atLeast + 1) and remembers it.
        Task<int> ReserveInvoiceSeqAsync(int atLeast);

        string DatabaseName { get; }
    }
}
