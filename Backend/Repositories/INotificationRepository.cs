using Backend.Models.Entities;

namespace Backend.Repositories
{
    public interface INotificationRepository
    {
        Task<List<Notification>> GetByUserAsync(int userId, string type);
        Task<int> GetUnreadCountAsync(int userId);
        Task<int> GetUnreadAlertCountAsync(int userId);
        Task AddAsync(Notification notification);
        Task<bool> MarkAsReadAsync(int id, int userId);
        Task MarkAllReadAsync(int userId, string type);
        Task<bool> DeleteAsync(int id, int userId);
        Task DeleteAllAsync(int userId, string type);
        Task DeleteAllForUserAsync(int userId);

        // Read notifications older than this are removed, so the table doesn't grow forever.
        Task PurgeReadAsync(DateTime before);
        Task PurgeAllAsync(DateTime before);
    }
}