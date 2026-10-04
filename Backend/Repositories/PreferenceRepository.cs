using Backend.Data;
using Backend.Models.Entities;
using Microsoft.EntityFrameworkCore;

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
                existing.IdleMinutes = preference.IdleMinutes;
                existing.NotificationSound = preference.NotificationSound;
                existing.MutedNotifications = preference.MutedNotifications;
                existing.UpdatedAt = AppTime.Now;
            }
            await _context.SaveChangesAsync();
        }

        public async Task<Dictionary<int, string?>> GetMutedAsync(IEnumerable<int> userIds)
        {
            var ids = userIds.Distinct().ToList();
            if (ids.Count == 0) return new Dictionary<int, string?>();

            return await _context.UserPreferences
                .AsNoTracking()
                .Where(p => ids.Contains(p.UserID) && p.MutedNotifications != null)
                .ToDictionaryAsync(p => p.UserID, p => p.MutedNotifications);
        }
    }
}
