using Backend.Auth;
using Backend.Models.DTOs;
using Backend.Models.Entities;
using Backend.Repositories;

namespace Backend.Services
{
    public class UserService : IUserService
    {
        private readonly IUserRepository _repository;
        private readonly IPermissionRepository _permissionRepository;
        private readonly INotificationRepository _notificationRepository;
        private readonly ISessionService _sessions;
        private readonly IPasswordResetRepository _passwordResets;

        private const string OneAdminOnly = "There can be only one Admin. Choose another role, eg Manager.";

        public UserService(
            IUserRepository repository,
            IPermissionRepository permissionRepository,
            INotificationRepository notificationRepository,
            ISessionService sessions,
            IPasswordResetRepository passwordResets)
        {
            _repository = repository;
            _permissionRepository = permissionRepository;
            _notificationRepository = notificationRepository;
            _sessions = sessions;
            _passwordResets = passwordResets;
        }

        public async Task<List<UserDto>> GetAllUsersAsync()
        {
            var users = await _repository.GetAllAsync();
            return users.Select(ToDto).ToList();
        }

        public async Task<UserDto?> GetUserByIdAsync(int id)
        {
            var user = await _repository.GetByIdAsync(id);
            return user == null ? null : ToDto(user);
        }

        public async Task<(bool, string?, UserDto?)> CreateUserAsync(CreateUserDto dto)
        {
            // Password is required when creating
            if (string.IsNullOrWhiteSpace(dto.Password))
                return (false, "Password is required for a new user.", null);

            if (await _repository.UsernameExistsAsync(dto.Username.Trim()))
                return (false, "That username is already taken.", null);

            if (IsAdminRole(dto.Role))
                return (false, OneAdminOnly, null);

            var passwordError = PasswordPolicy.Validate(dto.Password);
            if (passwordError != null)
                return (false, passwordError, null);

            var user = new User
            {
                Username = dto.Username.Trim(),
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password),
                Email = dto.Email.Trim(),
                FullName = dto.FullName.Trim(),
                Role = dto.Role.Trim(),
                Phone = dto.Phone?.Trim(),
                SecondaryPhone = dto.SecondaryPhone?.Trim(),
                EmployeeID = dto.EmployeeID,
                IsActive = dto.IsActive,
                CreatedAt = AppTime.Now,
                UpdatedAt = AppTime.Now
            };

            var created = await _repository.AddAsync(user);
            return (true, null, ToDto(created));
        }

        public async Task<(bool, string?, UserDto?)> UpdateUserAsync(int id, CreateUserDto dto, int currentUserId, int? keepLoginId)
        {
            var user = await _repository.GetByIdAsync(id);
            if (user == null) return (false, "User not found.", null);

            // The Admin can't remove their own access, and nobody else can be made Admin.
            if (id == currentUserId && IsAdminRole(user.Role) && !IsAdminRole(dto.Role))
                return (false, "You can't remove your own Admin role.", null);
            if (id == currentUserId && !dto.IsActive)
                return (false, "You cannot disable your own account.", null);
            if (IsAdminRole(dto.Role) && !IsAdminRole(user.Role))
                return (false, OneAdminOnly, null);

            if (await _repository.UsernameExistsAsync(dto.Username.Trim(), id))
                return (false, "That username is already taken.", null);

            var newPassword = !string.IsNullOrWhiteSpace(dto.Password);
            if (newPassword)
            {
                var passwordError = PasswordPolicy.Validate(dto.Password);
                if (passwordError != null)
                    return (false, passwordError, null);
            }

            // Signs the user out of every device when their tokens would be wrong or unsafe:
            //   - a new password or username (they sign in with the new one),
            //   - becoming Admin or no longer Admin (full access is read from the token),
            //   - a disabled account.
            // Any other role name change (eg Manager to Site Manager) keeps them signed in:
            // their access comes from Control Unit, which is always read fresh.
            var signOut = newPassword ||
                          !string.Equals(user.Username, dto.Username.Trim(), StringComparison.Ordinal) ||
                          IsAdminRole(user.Role) != IsAdminRole(dto.Role) ||
                          (user.IsActive && !dto.IsActive);

            var oldEmail = user.Email;
            user.Username = dto.Username.Trim();
            user.Email = dto.Email.Trim();
            user.FullName = dto.FullName.Trim();
            user.Role = dto.Role.Trim();
            user.Phone = dto.Phone?.Trim();
            user.SecondaryPhone = dto.SecondaryPhone?.Trim();
            user.EmployeeID = dto.EmployeeID;
            user.IsActive = dto.IsActive;
            user.UpdatedAt = AppTime.Now;

            if (newPassword)
                user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password!);

            await _repository.UpdateAsync(user);

            if (signOut)
                await _sessions.EndAllAsync(id, keepLoginId, SessionEndReasons.AccountChanged);

            // A reset link sent before the password or email changed must not work any more.
            if (newPassword || !string.Equals(oldEmail, user.Email, StringComparison.OrdinalIgnoreCase))
                await _passwordResets.DeleteUnusedAsync(id);

            return (true, null, ToDto(user));
        }

        public async Task<(bool, string?)> DeleteUserAsync(int id, int currentUserId)
        {
            // Nobody can delete their own account.
            if (id == currentUserId)
                return (false, "You cannot delete your own account.");

            // Clean up this user's related data before deleting the account
            await _permissionRepository.DeleteAllForUserAsync(id);
            await _notificationRepository.DeleteAllForUserAsync(id);

            var deleted = await _repository.DeleteAsync(id);
            return deleted ? (true, null) : (false, "User not found.");
        }

        public async Task<(bool, string?)> ToggleStatusAsync(int id, int currentUserId)
        {
            // Nobody can disable their own account.
            if (id == currentUserId)
                return (false, "You cannot disable your own account.");

            var user = await _repository.GetByIdAsync(id);
            if (user == null) return (false, "User not found.");

            user.IsActive = !user.IsActive;
            user.UpdatedAt = AppTime.Now;
            await _repository.UpdateAsync(user);

            // Disabled: signed out of every device at once.
            if (!user.IsActive)
                await _sessions.EndAllAsync(id, null, SessionEndReasons.AccountChanged);

            return (true, null);
        }

        public async Task<SecurityOverviewDto?> GetSecurityAsync(int id)
        {
            var user = await _repository.GetByIdAsync(id);
            return user == null ? null : await _sessions.GetOverviewAsync(id, null);
        }

        public async Task<(bool, string?, int)> SignOutEverywhereAsync(int id, int currentUserId)
        {
            if (id == currentUserId)
                return (false, "Manage your own devices in Settings > Security.", 0);

            var user = await _repository.GetByIdAsync(id);
            if (user == null) return (false, "User not found.", 0);

            var ended = await _sessions.EndAllAsync(id, null, SessionEndReasons.SignedOutRemotely);
            return (true, null, ended);
        }

        private static bool IsAdminRole(string? role) =>
            string.Equals(role?.Trim(), "Admin", StringComparison.OrdinalIgnoreCase);

        // The password hash never leaves this service.
        private UserDto ToDto(User u)
        {
            return new UserDto
            {
                UserID = u.UserID,
                Username = u.Username,
                Email = u.Email,
                FullName = u.FullName,
                Role = u.Role,
                Phone = u.Phone,
                SecondaryPhone = u.SecondaryPhone,
                ProfilePicture = u.ProfilePicture,
                EmployeeID = u.EmployeeID,
                IsActive = u.IsActive,
                LastLogin = u.LastLogin,
                CreatedAt = u.CreatedAt
            };
        }
    }
}
