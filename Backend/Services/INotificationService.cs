using Backend.Models.DTOs;

namespace Backend.Services
{
    public interface INotificationService
    {
        // Removes read notifications older than 90 days.
        Task PurgeOldAsync();

        Task<List<NotificationDto>> GetForUserAsync(int userId, string type);
        Task<int> GetUnreadCountAsync(int userId);
        Task<int> GetUnreadAlertCountAsync(int userId);

        // Used across the app to create notifications.
        Task NotifyPersonalAsync(int userId, string category, string title, string message, string? reason = null, string? link = null);
        Task NotifyAdminsActivityAsync(string category, string title, string message, int? excludeUserId = null, bool includeActingUser = false, string? link = null);
        Task NotifyPermissionHoldersAsync(string module, string action, string category, string title, string message, int? excludeUserId = null, string? link = null);

        Task<bool> MarkAsReadAsync(int id, int userId);
        Task MarkAllReadAsync(int userId, string type, int? upTo = null);
        Task<bool> DeleteAsync(int id, int userId);
        Task DeleteAllAsync(int userId, string type);
    }
}