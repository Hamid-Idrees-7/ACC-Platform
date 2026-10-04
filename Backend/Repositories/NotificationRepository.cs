using Backend.Data;
using Backend.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace Backend.Repositories
{
    public class NotificationRepository : INotificationRepository
    {
        private readonly AppDbContext _context;

        public NotificationRepository(AppDbContext context)
        {
            _context = context;
        }

        // A user's notifications of one type (Personal or Activity), newest first
        public async Task<List<Notification>> GetByUserAsync(int userId, string type)
        {
            return await _context.Notifications
                .Where(n => n.UserID == userId && n.Type == type)
                .OrderByDescending(n => n.NotificationID)
                .Take(ListLimit)
                .ToListAsync();
        }

        // Unread personal notifications (for the bell badge)
        public async Task<int> GetUnreadCountAsync(int userId)
        {
            return await _context.Notifications
                .CountAsync(n => n.UserID == userId && n.Type == "Personal" && !n.IsRead);
        }

        public async Task<int> GetUnreadAlertCountAsync(int userId)
        {
            return await _context.Notifications
                .CountAsync(n => n.UserID == userId && n.Type == "Personal" && !n.IsRead && !n.FromSelf);
        }

        public async Task AddAsync(Notification notification)
        {
            // Texts built from names and amounts can run long; keep them inside their columns.
            notification.Title = Cut(notification.Title, 150);
            notification.Message = Cut(notification.Message, 400);
            notification.Reason = notification.Reason == null ? null : Cut(notification.Reason, 300);
            if (notification.Link?.Length > 200) notification.Link = null;

            _context.Notifications.Add(notification);
            await _context.SaveChangesAsync();
        }

        // The page shows the latest ones; older ones are still counted and kept until cleaned up.
        private const int ListLimit = 200;

        private static string Cut(string text, int max) => text.Length <= max ? text : text[..(max - 3)] + "...";

        public async Task PurgeReadAsync(DateTime before)
        {
            await _context.Notifications.Where(n => n.IsRead && n.CreatedAt < before).ExecuteDeleteAsync();
        }

        public async Task PurgeAllAsync(DateTime before)
        {
            await _context.Notifications.Where(n => n.CreatedAt < before).ExecuteDeleteAsync();
        }

        // Only if it belongs to this user
        public async Task<bool> MarkAsReadAsync(int id, int userId)
        {
            var n = await _context.Notifications
                .FirstOrDefaultAsync(x => x.NotificationID == id && x.UserID == userId);
            if (n == null) return false;

            n.IsRead = true;
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task MarkAllReadAsync(int userId, string type, int? upTo = null)
        {
            var items = await _context.Notifications
                .Where(n => n.UserID == userId && n.Type == type && !n.IsRead && (upTo == null || n.NotificationID <= upTo))
                .ToListAsync();

            foreach (var n in items) n.IsRead = true;
            if (items.Any()) await _context.SaveChangesAsync();
        }

        // Only if it belongs to this user
        public async Task<bool> DeleteAsync(int id, int userId)
        {
            var n = await _context.Notifications
                .FirstOrDefaultAsync(x => x.NotificationID == id && x.UserID == userId);
            if (n == null) return false;

            _context.Notifications.Remove(n);
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task DeleteAllAsync(int userId, string type)
        {
            var items = await _context.Notifications
                .Where(n => n.UserID == userId && n.Type == type)
                .ToListAsync();

            if (items.Any())
            {
                _context.Notifications.RemoveRange(items);
                await _context.SaveChangesAsync();
            }
        }

        // Called when the user is deleted
        public async Task DeleteAllForUserAsync(int userId)
        {
            var items = await _context.Notifications
                .Where(n => n.UserID == userId)
                .ToListAsync();

            if (items.Any())
            {
                _context.Notifications.RemoveRange(items);
                await _context.SaveChangesAsync();
            }
        }
    }
}