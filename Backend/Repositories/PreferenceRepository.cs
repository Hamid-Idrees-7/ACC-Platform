using Backend.Data;
using Backend.Models.Entities;

namespace Backend.Repositories
{
    public class PreferenceRepository : IPreferenceRepository
    {
        private readonly AppDbContext _context;

        public PreferenceRepository(AppDbContext context)
        {
            _context = context;
        }

        public async Task<UserPreference?> GetAsync(int userId)
        {
            return await _context.UserPreferences.FindAsync(userId);
        }

        public async Task SaveAsync(UserPreference preference)
        {
            var existing = await _context.UserPreferences.FindAsync(preference.UserID);
            if (existing == null)
            {
                _context.UserPreferences.Add(preference);
            }
            else
            {
                existing.Theme = preference.Theme;
                existing.NumberFormat = preference.NumberFormat;
                existing.DateFormat = preference.DateFormat;
                existing.TimeFormat = preference.TimeFormat;
                existing.UpdatedAt = DateTime.Now;
            }
            await _context.SaveChangesAsync();
        }
    }
}
