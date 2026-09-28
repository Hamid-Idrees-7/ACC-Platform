using Backend.Models.Entities;

namespace Backend.Repositories
{
    public interface ILoginActivityRepository
    {
        Task AddAsync(LoginActivity activity);
        Task<LoginActivity?> GetAsync(int id);

        // Wrong-password attempts for this username from this IP since the given time, newest first.
        Task<List<DateTime>> GetFailureTimesAsync(string username, string? ipAddress, DateTime sinceUtc);

        // The last successful sign-in for this username from this IP (resets the failure count).
        Task<DateTime?> GetLastSuccessAsync(string username, string? ipAddress);

        // Sign-in history of one user, newest first.
        Task<List<LoginActivity>> GetRecentAsync(int userId, DateTime sinceUtc, int take);

        // Sessions of one user that have not ended and have not expired.
        Task<List<LoginActivity>> GetOpenSessionsAsync(int userId, DateTime nowUtc);

        // Ends every open session of the user (except one), returns how many were ended.
        Task<int> EndSessionsAsync(int userId, int? exceptId, string reason, DateTime nowUtc);

        Task SaveChangesAsync();

        // Deletes history older than the cut-off.
        Task PurgeAsync(DateTime beforeUtc);

        Task<List<string?>> GetSignInAgentsAsync(int userId, int exceptId);
    }
}
