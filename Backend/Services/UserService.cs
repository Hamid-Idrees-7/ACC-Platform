using Backend.Models.DTOs;
using Backend.Models.Entities;
using Backend.Repositories;

namespace Backend.Services
{
    public class UserService : IUserService
    {
        private readonly IUserRepository _repository;
        private readonly IPermissionRepository _permissionRepository;

        public UserService(IUserRepository repository, IPermissionRepository permissionRepository)
        {
            _repository = repository;
            _permissionRepository = permissionRepository;
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

            // Username must be unique
            if (await _repository.UsernameExistsAsync(dto.Username.Trim()))
                return (false, "That username is already taken.", null);

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
                CreatedAt = DateTime.Now,
                UpdatedAt = DateTime.Now
            };

            var created = await _repository.AddAsync(user);
            return (true, null, ToDto(created));
        }

        public async Task<(bool, string?, UserDto?)> UpdateUserAsync(int id, CreateUserDto dto)
        {
            var user = await _repository.GetByIdAsync(id);
            if (user == null) return (false, "User not found.", null);

            // Username must be unique (ignoring this same user)
            if (await _repository.UsernameExistsAsync(dto.Username.Trim(), id))
                return (false, "That username is already taken.", null);

            user.Username = dto.Username.Trim();
            user.Email = dto.Email.Trim();
            user.FullName = dto.FullName.Trim();
            user.Role = dto.Role.Trim();
            user.Phone = dto.Phone?.Trim();
            user.SecondaryPhone = dto.SecondaryPhone?.Trim();
            user.EmployeeID = dto.EmployeeID;
            user.IsActive = dto.IsActive;
            user.UpdatedAt = DateTime.Now;

            // Only change the password if a new one was provided
            if (!string.IsNullOrWhiteSpace(dto.Password))
                user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password);

            await _repository.UpdateAsync(user);
            return (true, null, ToDto(user));
        }

        public async Task<(bool, string?)> DeleteUserAsync(int id, int currentUserId)
        {
            // Safety: a user cannot delete their own account
            if (id == currentUserId)
                return (false, "You cannot delete your own account.");

            // Clean up this user's permissions before deleting the account
            await _permissionRepository.DeleteAllForUserAsync(id);

            var deleted = await _repository.DeleteAsync(id);
            return deleted ? (true, null) : (false, "User not found.");
        }

        public async Task<(bool, string?)> ToggleStatusAsync(int id, int currentUserId)
        {
            // Safety: a user cannot disable their own account
            if (id == currentUserId)
                return (false, "You cannot disable your own account.");

            var user = await _repository.GetByIdAsync(id);
            if (user == null) return (false, "User not found.");

            user.IsActive = !user.IsActive;
            user.UpdatedAt = DateTime.Now;
            await _repository.UpdateAsync(user);
            return (true, null);
        }

        // Convert entity to DTO (never exposes the password hash)
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