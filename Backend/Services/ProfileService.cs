using Backend.Data;
using Backend.Models.DTOs;
using Microsoft.EntityFrameworkCore;

namespace Backend.Services
{
    public class ProfileService : IProfileService
    {
        private readonly AppDbContext _context;

        public ProfileService(AppDbContext context)
        {
            _context = context;
        }

        // Get the logged-in user's profile
        public async Task<ProfileDto?> GetProfileAsync(int userId)
        {
            var user = await _context.Users.FindAsync(userId);
            if (user == null) return null;

            return new ProfileDto
            {
                UserID = user.UserID,
                Username = user.Username,
                FullName = user.FullName,
                Email = user.Email,
                Role = user.Role,
                Phone = user.Phone,
                SecondaryPhone = user.SecondaryPhone,
                Bio = user.Bio,
                ProfilePicture = user.ProfilePicture
            };
        }

        // Update editable profile fields
        public async Task<(bool Success, string Message)> UpdateProfileAsync(int userId, UpdateProfileDto dto)
        {
            var user = await _context.Users.FindAsync(userId);
            if (user == null) return (false, "User not found.");

            user.FullName = dto.FullName.Trim();
            user.Email = dto.Email.Trim();
            user.Phone = dto.Phone?.Trim();
            user.SecondaryPhone = dto.SecondaryPhone?.Trim();
            user.Bio = dto.Bio?.Trim();
            user.UpdatedAt = DateTime.Now;

            await _context.SaveChangesAsync();
            return (true, "Profile updated successfully.");
        }

        // Change password after verifying the current one
        public async Task<(bool Success, string Message)> ChangePasswordAsync(int userId, ChangePasswordDto dto)
        {
            var user = await _context.Users.FindAsync(userId);
            if (user == null) return (false, "User not found.");

            // Verify current password
            if (!BCrypt.Net.BCrypt.Verify(dto.CurrentPassword, user.PasswordHash))
                return (false, "Your current password is incorrect.");

            // New must be different from current
            if (BCrypt.Net.BCrypt.Verify(dto.NewPassword, user.PasswordHash))
                return (false, "New password must be different from your current password.");

            // Hash and save the new password
            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.NewPassword);
            user.UpdatedAt = DateTime.Now;

            await _context.SaveChangesAsync();
            return (true, "Password changed successfully.");
        }

        // Change username after verifying the current password (re-authentication)
        public async Task<(bool Success, string? Error)> ChangeUsernameAsync(int userId, ChangeUsernameDto dto)
        {
            var user = await _context.Users.FindAsync(userId);
            if (user == null) return (false, "User not found.");

            // Re-authenticate: verify the current password
            if (!BCrypt.Net.BCrypt.Verify(dto.CurrentPassword, user.PasswordHash))
                return (false, "Password is incorrect.");

            var newUsername = dto.NewUsername.Trim();

            if (newUsername.Length < 3)
                return (false, "Username must be at least 3 characters.");
            if (newUsername.Contains(" "))
                return (false, "Username cannot contain spaces.");

            // Must be unique (ignoring this same user)
            var taken = await _context.Users
                .AnyAsync(u => u.Username == newUsername && u.UserID != userId);
            if (taken) return (false, "That username is already taken.");

            // Same as current?
            if (user.Username == newUsername)
                return (false, "That's already your username.");

            user.Username = newUsername;
            user.UpdatedAt = DateTime.Now;
            await _context.SaveChangesAsync();
            return (true, null);
        }

        // Verify the user's current password (for sensitive-action re-authentication)
        public async Task<bool> VerifyPasswordAsync(int userId, string password)
        {
            var user = await _context.Users.FindAsync(userId);
            if (user == null) return false;
            return BCrypt.Net.BCrypt.Verify(password, user.PasswordHash);
        }

        // Update profile picture (Base64 string)
        public async Task<(bool Success, string Message)> UpdatePictureAsync(int userId, string? base64Image)
        {
            var user = await _context.Users.FindAsync(userId);
            if (user == null) return (false, "User not found.");

            user.ProfilePicture = base64Image;
            user.UpdatedAt = DateTime.Now;

            await _context.SaveChangesAsync();
            return (true, "Profile picture updated.");
        }
    }
}