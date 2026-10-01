using Backend.Models.Entities;

namespace Backend.Repositories
{
    public interface IPasswordResetRepository
    {
        // Active accounts whose username or email is this text (any letter case).
        Task<List<User>> FindAccountsAsync(string login);

        Task<DateTime?> GetLastRequestAsync(int userId);

        // Adds a new link and removes the account's older unused links, so only the newest one works.
        Task AddAsync(PasswordReset reset);

        Task<PasswordReset?> GetByHashAsync(string codeHash);

        Task<User?> GetUserAsync(int userId);

        // Links older than this are deleted (used or not).
        Task PurgeAsync(DateTime beforeUtc);

        Task SaveChangesAsync();
    }
}
