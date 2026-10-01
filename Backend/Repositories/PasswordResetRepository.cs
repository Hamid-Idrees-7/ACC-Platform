using Backend.Data;
using Backend.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace Backend.Repositories
{
    public class PasswordResetRepository : IPasswordResetRepository
    {
        private readonly AppDbContext _context;

        public PasswordResetRepository(AppDbContext context)
        {
            _context = context;
        }

        public async Task<List<User>> FindAccountsAsync(string login)
        {
            var text = login.Trim().ToLower();
            return await _context.Users
                .Where(u => u.IsActive && (u.Username.ToLower() == text || u.Email.ToLower() == text))
                .ToListAsync();
        }

        public async Task<DateTime?> GetLastRequestAsync(int userId)
        {
            return await _context.PasswordResets
                .AsNoTracking()
                .Where(r => r.UserID == userId)
                .OrderByDescending(r => r.CreatedAt)
                .Select(r => (DateTime?)r.CreatedAt)
                .FirstOrDefaultAsync();
        }

        public async Task AddAsync(PasswordReset reset)
        {
            await _context.PasswordResets
                .Where(r => r.UserID == reset.UserID && r.UsedAt == null)
                .ExecuteDeleteAsync();
            _context.PasswordResets.Add(reset);
            await _context.SaveChangesAsync();
        }

        public async Task<PasswordReset?> GetByHashAsync(string codeHash)
        {
            return await _context.PasswordResets.FirstOrDefaultAsync(r => r.CodeHash == codeHash);
        }

        public async Task<User?> GetUserAsync(int userId)
        {
            return await _context.Users.FindAsync(userId);
        }

        public async Task PurgeAsync(DateTime beforeUtc)
        {
            await _context.PasswordResets.Where(r => r.CreatedAt < beforeUtc).ExecuteDeleteAsync();
        }

        public Task SaveChangesAsync() => _context.SaveChangesAsync();
    }
}
