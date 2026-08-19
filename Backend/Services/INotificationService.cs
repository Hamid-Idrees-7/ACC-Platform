using Backend.Models.DTOs;

namespace Backend.Services
{
    public interface INotificationService
    {
        Task<List<NotificationDto>> GetForUserAsync(int userId, string type);
        Task<int> GetUnreadCountAsync(int userId);

        // Central helpers used across the app to create notifications
        Task NotifyPersonalAsync(int userId, string category, string title, string message, string? reason = null);
        Task NotifyAdminsActivityAsync(string category, string title, string message);

        Task<bool> MarkAsReadAsync(int id, int userId);
        Task MarkAllReadAsync(int userId, string type);
        Task<bool> DeleteAsync(int id, int userId);
        Task DeleteAllAsync(int userId, string type);
    }
}