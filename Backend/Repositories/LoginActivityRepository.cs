using Backend.Data;
using Backend.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace Backend.Repositories
{
    public class LoginActivityRepository : ILoginActivityRepository
    {
        private readonly AppDbContext _context;

        public LoginActivityRepository(AppDbContext context)
        {
            _context = context;
        }

        public async Task AddAsync(LoginActivity activity)
        {
            _context.LoginActivities.Add(activity);
            await _context.SaveChangesAsync();
        }

        public async Task<LoginActivity?> GetAsync(int id)
        {
            return await _context.LoginActivities.FindAsync(id);
        }

        public async Task<List<DateTime>> GetFailureTimesAsync(string username, string? ipAddress, DateTime sinceUtc)
        {
            return await _context.LoginActivities
                .AsNoTracking()
                .Where(a => a.Username == username && a.IpAddress == ipAddress &&
                            a.Result == LoginResults.WrongPassword && a.CreatedAt > sinceUtc)
                .OrderByDescending(a => a.CreatedAt)
                .Select(a => a.CreatedAt)
                .ToListAsync();
        }

        public async Task<DateTime?> GetLastSuccessAsync(string username, string? ipAddress)
        {
            return await _context.LoginActivities
                .AsNoTracking()
                .Where(a => a.Username == username && a.IpAddress == ipAddress && a.Result == LoginResults.SignedIn)
                .OrderByDescending(a => a.CreatedAt)
                .Select(a => (DateTime?)a.CreatedAt)
                .FirstOrDefaultAsync();
        }

        public async Task<List<LoginActivity>> GetRecentAsync(int userId, DateTime sinceUtc, int take)
        {
            return await _context.LoginActivities
                .AsNoTracking()
                .Where(a => a.UserID == userId && a.CreatedAt > sinceUtc)
                .OrderByDescending(a => a.CreatedAt)
                .Take(take)
                .ToListAsync();
        }

        public async Task<List<LoginActivity>> GetOpenSessionsAsync(int userId, DateTime nowUtc)
        {
            return await _context.LoginActivities
                .Where(a => a.UserID == userId && a.Result == LoginResults.SignedIn &&
                            a.EndedAt == null && a.ExpiresAt > nowUtc)
                .OrderByDescending(a => a.CreatedAt)
                .ToListAsync();
        }

        public async Task<int> EndSessionsAsync(int userId, int? exceptId, string reason, DateTime nowUtc)
        {
            var open = await GetOpenSessionsAsync(userId, nowUtc);
            var ended = 0;
            foreach (var session in open)
            {
                if (session.LoginActivityID == exceptId) continue;
                session.EndedAt = nowUtc;
                session.EndReason = reason;
                ended++;
            }

            if (ended > 0) await _context.SaveChangesAsync();
            return ended;
        }

        public async Task SaveChangesAsync()
        {
            await _context.SaveChangesAsync();
        }

        public async Task PurgeAsync(DateTime beforeUtc)
        {
            await _context.LoginActivities
                .Where(a => a.CreatedAt < beforeUtc)
                .ExecuteDeleteAsync();
        }
    }
}
