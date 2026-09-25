using Backend.Models.DTOs;
using Backend.Models.Entities;
using Backend.Repositories;

namespace Backend.Services
{
    public class NotificationService : INotificationService
    {
        private readonly INotificationRepository _repository;
        private readonly IUserRepository _userRepository;
        private readonly IPermissionRepository _permissionRepository;

        public NotificationService(
            INotificationRepository repository,
            IUserRepository userRepository,
            IPermissionRepository permissionRepository)
        {
            _repository = repository;
            _userRepository = userRepository;
            _permissionRepository = permissionRepository;
        }

        public async Task<List<NotificationDto>> GetForUserAsync(int userId, string type)
        {
            var list = await _repository.GetByUserAsync(userId, type);
            return list.Select(ToDto).ToList();
        }

        public async Task<int> GetUnreadCountAsync(int userId)
        {
            return await _repository.GetUnreadCountAsync(userId);
        }

        // Create a personal notification for one user (their own activity / approval updates)
        public async Task NotifyPersonalAsync(int userId, string category, string title, string message, string? reason = null)
        {
            await _repository.AddAsync(new Notification
            {
                UserID = userId,
                Type = "Personal",
                Category = category,
                Title = title,
                Message = message,
                Reason = reason,
                IsRead = false,
                CreatedAt = DateTime.Now
            });
        }

        // Create an activity notification for every admin (records what a user did).
        // excludeUserId skips one user — used so an admin who performs an action isn't
        // notified about their own action in the audit feed.
        public async Task NotifyAdminsActivityAsync(string category, string title, string message, int? excludeUserId = null)
        {
            var users = await _userRepository.GetAllAsync();
            var admins = users.Where(u => u.Role != null &&
                                          u.Role.Equals("Admin", StringComparison.OrdinalIgnoreCase) &&
                                          u.IsActive &&
                                          u.UserID != excludeUserId);

            foreach (var admin in admins)
            {
                await _repository.AddAsync(new Notification
                {
                    UserID = admin.UserID,
                    Type = "Activity",
                    Category = category,
                    Title = title,
                    Message = message,
                    IsRead = false,
                    CreatedAt = DateTime.Now
                });
            }
        }

        // Send a personal (action needed) notification to every non-admin user who holds a
        // given permission (module+action, and the module's View baseline) and is active.
        // Admins are intentionally skipped here — they get the audit via NotifyAdminsActivityAsync.
        // excludeUserId skips one user (e.g. the person who raised the request).
        public async Task NotifyPermissionHoldersAsync(string module, string action, string category, string title, string message, int? excludeUserId = null)
        {
            var perms = await _permissionRepository.GetAllAsync();

            var canAct = perms.Where(p => p.Module == module && p.Action == action && p.IsAllowed)
                              .Select(p => p.UserID).ToHashSet();
            var canView = perms.Where(p => p.Module == module && p.Action == "View" && p.IsAllowed)
                               .Select(p => p.UserID).ToHashSet();
            var eligibleIds = canAct.Where(id => canView.Contains(id)).ToHashSet();
            if (eligibleIds.Count == 0) return;

            var users = await _userRepository.GetAllAsync();
            var recipients = users.Where(u => eligibleIds.Contains(u.UserID) &&
                                              u.IsActive &&
                                              u.UserID != excludeUserId &&
                                              !(u.Role != null && u.Role.Equals("Admin", StringComparison.OrdinalIgnoreCase)));

            foreach (var u in recipients)
            {
                await _repository.AddAsync(new Notification
                {
                    UserID = u.UserID,
                    Type = "Personal",
                    Category = category,
                    Title = title,
                    Message = message,
                    IsRead = false,
                    CreatedAt = DateTime.Now
                });
            }
        }

        public async Task<bool> MarkAsReadAsync(int id, int userId) =>
            await _repository.MarkAsReadAsync(id, userId);

        public async Task MarkAllReadAsync(int userId, string type) =>
            await _repository.MarkAllReadAsync(userId, type);

        public async Task<bool> DeleteAsync(int id, int userId) =>
            await _repository.DeleteAsync(id, userId);

        public async Task DeleteAllAsync(int userId, string type) =>
            await _repository.DeleteAllAsync(userId, type);

        private NotificationDto ToDto(Notification n) => new NotificationDto
        {
            NotificationID = n.NotificationID,
            UserID = n.UserID,
            Type = n.Type,
            Category = n.Category,
            Title = n.Title,
            Message = n.Message,
            Reason = n.Reason,
            IsRead = n.IsRead,
            CreatedAt = n.CreatedAt
        };
    }
}