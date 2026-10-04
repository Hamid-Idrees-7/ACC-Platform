using Backend.Auth;
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

        // Failures and successes are matched by network (the IPv4 address, or the /64 of an IPv6
        // address), the same key the sign-in rate limit uses, so new IPv6 addresses don't reset it.
        public async Task<List<DateTime>> GetFailureTimesAsync(string username, string? ipAddress, DateTime sinceUtc)
        {
            var network = ClientPartition.For(ipAddress);
            var ipv6 = IsIpv6(network);
            var rows = await _context.LoginActivities
                .AsNoTracking()
                .Where(a => a.Username == username && a.Result == LoginResults.WrongPassword && a.CreatedAt > sinceUtc)
                .Where(a => ipv6 || a.IpAddress == ipAddress)
                .OrderByDescending(a => a.CreatedAt)
                .Select(a => new { a.CreatedAt, a.IpAddress })
                .Take(500)
                .ToListAsync();
            return rows.Where(r => ClientPartition.For(r.IpAddress) == network).Select(r => r.CreatedAt).ToList();
        }

        // An IPv6 /64 is matched in memory below; anything else is matched exactly in SQL
        private static bool IsIpv6(string network) => network.EndsWith("::/64", StringComparison.Ordinal);

        public async Task<DateTime?> GetLastSuccessAsync(string username, string? ipAddress)
        {
            var network = ClientPartition.For(ipAddress);
            var ipv6 = IsIpv6(network);
            var rows = await _context.LoginActivities
                .AsNoTracking()
                .Where(a => a.Username == username &&
                            (a.Result == LoginResults.SignedIn || a.Result == LoginResults.PasswordReset))
                .Where(a => ipv6 || a.IpAddress == ipAddress)
                .OrderByDescending(a => a.CreatedAt)
                .Select(a => new { a.CreatedAt, a.IpAddress })
                .Take(200)
                .ToListAsync();
            return rows.Where(r => ClientPartition.For(r.IpAddress) == network).Select(r => (DateTime?)r.CreatedAt).FirstOrDefault();
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

        public async Task<List<string?>> GetSignInAgentsAsync(int userId, int exceptId)
        {
            return await _context.LoginActivities
                .Where(a => a.UserID == userId && a.Result == LoginResults.SignedIn && a.LoginActivityID != exceptId)
                .Select(a => a.UserAgent)
                .Distinct()
                .ToListAsync();
        }
    }
}
