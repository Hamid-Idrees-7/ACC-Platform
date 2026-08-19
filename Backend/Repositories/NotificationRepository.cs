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

        // Get a user's notifications of a given type (Personal or Activity), newest first
        public async Task<List<Notification>> GetByUserAsync(int userId, string type)
        {
            return await _context.Notifications
                .Where(n => n.UserID == userId && n.Type == type)
                .OrderByDescending(n => n.NotificationID)
                .ToListAsync();
        }

        // Count of unread PERSONAL notifications (for the bell badge)
        public async Task<int> GetUnreadCountAsync(int userId)
        {
            return await _context.Notifications
                .CountAsync(n => n.UserID == userId && n.Type == "Personal" && !n.IsRead);
        }

        public async Task AddAsync(Notification notification)
        {
            _context.Notifications.Add(notification);
            await _context.SaveChangesAsync();
        }

        // Mark one as read (only if it belongs to this user)
        public async Task<bool> MarkAsReadAsync(int id, int userId)
        {
            var n = await _context.Notifications
                .FirstOrDefaultAsync(x => x.NotificationID == id && x.UserID == userId);
            if (n == null) return false;

            n.IsRead = true;
            await _context.SaveChangesAsync();
            return true;
        }

        // Mark all of a type as read for this user
        public async Task MarkAllReadAsync(int userId, string type)
        {
            var items = await _context.Notifications
                .Where(n => n.UserID == userId && n.Type == type && !n.IsRead)
                .ToListAsync();

            foreach (var n in items) n.IsRead = true;
            if (items.Any()) await _context.SaveChangesAsync();
        }

        // Delete one (only if it belongs to this user)
        public async Task<bool> DeleteAsync(int id, int userId)
        {
            var n = await _context.Notifications
                .FirstOrDefaultAsync(x => x.NotificationID == id && x.UserID == userId);
            if (n == null) return false;

            _context.Notifications.Remove(n);
            await _context.SaveChangesAsync();
            return true;
        }

        // Delete all of a type for this user
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

        // Remove all notifications for a user (called when the user is deleted)
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