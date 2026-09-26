using Backend.Models.Entities;

namespace Backend.Repositories
{
    public interface IPreferenceRepository
    {
        // The saved settings of a user, or null when they never changed anything.
        Task<UserPreference?> GetAsync(int userId);

        // Creates the row the first time, updates it afterwards.
        Task SaveAsync(UserPreference preference);
    }
}
