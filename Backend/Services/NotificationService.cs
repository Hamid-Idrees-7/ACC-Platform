using System.Security.Claims;
using Backend.Demo;
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
        private readonly IPreferenceRepository _preferenceRepository;
        private readonly IHttpContextAccessor _http;

        public NotificationService(
            INotificationRepository repository,
            IUserRepository userRepository,
            IPermissionRepository permissionRepository,
            IPreferenceRepository preferenceRepository,
            IHttpContextAccessor http)
        {
            _repository = repository;
            _userRepository = userRepository;
            _permissionRepository = permissionRepository;
            _preferenceRepository = preferenceRepository;
            _http = http;
        }

        // The signed-in user behind this request. Public endpoints pinned to the real database
        // (eg the website contact form) aren't done as that user, even if the browser holds a token
        // (it may even be a demo token from another database), so they have no acting user.
        private int? ActingUserId
        {
            get
            {
                var context = _http.HttpContext;
                if (context == null) return null;
                if (context.GetEndpoint()?.Metadata.GetMetadata<UseMainDatabaseAttribute>() != null)
                    return null;
                return int.TryParse(context.User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null;
            }
        }

        private async Task<HashSet<int>> MutedForAsync(IEnumerable<int> userIds, string category)
        {
            var muted = await _preferenceRepository.GetMutedAsync(userIds);
            return muted.Where(m => NotificationCategories.IsMuted(m.Value, category))
                        .Select(m => m.Key)
                        .ToHashSet();
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

        public async Task<int> GetUnreadAlertCountAsync(int userId)
        {
            return await _repository.GetUnreadAlertCountAsync(userId);
        }

        // A personal notification for one user (their own activity or approval updates).
        public async Task NotifyPersonalAsync(int userId, string category, string title, string message, string? reason = null, string? link = null)
        {
            if ((await MutedForAsync(new[] { userId }, category)).Contains(userId)) return;

            await _repository.AddAsync(new Notification
            {
                UserID = userId,
                Type = "Personal",
                Category = category,
                Title = title,
                Message = message,
                Reason = reason,
                Link = link,
                IsRead = false,
                FromSelf = ActingUserId == userId,
                CreatedAt = DateTime.Now
            });
        }

        // Create an activity notification for every admin (records what a user did).
        // The admin who performed the action is left out, unless includeActingUser is set.
        public async Task NotifyAdminsActivityAsync(string category, string title, string message, int? excludeUserId = null, bool includeActingUser = false, string? link = null)
        {
            var exclude = excludeUserId ?? (includeActingUser ? null : ActingUserId);
            var users = await _userRepository.GetAllLightAsync();
            var admins = users.Where(u => u.Role != null &&
                                          u.Role.Equals("Admin", StringComparison.OrdinalIgnoreCase) &&
                                          u.IsActive &&
                                          u.UserID != exclude);

            foreach (var admin in admins)
            {
                await _repository.AddAsync(new Notification
                {
                    UserID = admin.UserID,
                    Type = "Activity",
                    Category = category,
                    Title = title,
                    Message = message,
                    Link = link,
                    IsRead = false,
                    CreatedAt = DateTime.Now
                });
            }
        }

        // Send a personal (action needed) notification to every active admin and every user who
        // holds a given permission (module+action, and the module's View baseline).
        // excludeUserId skips one user (eg the person who raised the request).
        public async Task NotifyPermissionHoldersAsync(string module, string action, string category, string title, string message, int? excludeUserId = null, string? link = null)
        {
            var perms = await _permissionRepository.GetAllAsync();

            var canAct = perms.Where(p => p.Module == module && p.Action == action && p.IsAllowed)
                              .Select(p => p.UserID).ToHashSet();
            var canView = perms.Where(p => p.Module == module && p.Action == "View" && p.IsAllowed)
                               .Select(p => p.UserID).ToHashSet();
            var eligibleIds = canAct.Where(id => canView.Contains(id)).ToHashSet();

            var users = await _userRepository.GetAllLightAsync();
            var recipients = users.Where(u => u.IsActive &&
                                              u.UserID != excludeUserId &&
                                              (eligibleIds.Contains(u.UserID) ||
                                               (u.Role != null && u.Role.Equals("Admin", StringComparison.OrdinalIgnoreCase))))
                                  .ToList();

            var muted = await MutedForAsync(recipients.Select(u => u.UserID), category);

            foreach (var u in recipients.Where(u => !muted.Contains(u.UserID)))
            {
                await _repository.AddAsync(new Notification
                {
                    UserID = u.UserID,
                    Type = "Personal",
                    Category = category,
                    Title = title,
                    Message = message,
                    Link = link,
                    IsRead = false,
                    FromSelf = ActingUserId == u.UserID,
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
            Link = n.Link,
            CreatedAt = n.CreatedAt
        };
    }
}