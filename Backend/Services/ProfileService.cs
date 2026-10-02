using System.Text.RegularExpressions;
using Backend.Auth;
using Backend.Data;
using Backend.Models.DTOs;
using Backend.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace Backend.Services
{
    public class ProfileService : IProfileService
    {
        private readonly AppDbContext _context;
        private readonly ISessionService _sessions;

        public ProfileService(AppDbContext context, ISessionService sessions)
        {
            _context = context;
            _sessions = sessions;
        }

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

        public async Task<(bool Success, string Message, string? Field)> UpdateProfileAsync(int userId, UpdateProfileDto dto, bool emailNeedsPassword)
        {
            var user = await _context.Users.FindAsync(userId);
            if (user == null) return (false, "User not found.", null);

            // Same rules as the Settings page, checked again here.
            var fullName = (dto.FullName ?? "").Trim();
            if (fullName.Length < 2) return (false, "Enter your full name.", "fullName");
            if (fullName.Length > 100) return (false, "The name can be at most 100 characters.", "fullName");
            if (!Regex.IsMatch(fullName, @"^[\p{L}][\p{L}\s.'-]*$"))
                return (false, "The name can only contain letters, spaces, dots and dashes.", "fullName");

            var email = (dto.Email ?? "").Trim();
            if (email.Length == 0) return (false, "Enter your email address.", "email");
            if (email.Length > 100 || !Regex.IsMatch(email, @"^[^@\s]+@[^@\s]+\.[^@\s]+$"))
                return (false, "Enter a valid email address.", "email");

            var phone = NormalizePhone(dto.Phone);
            if (string.IsNullOrWhiteSpace(dto.Phone)) return (false, "Enter your phone number.", "phone");
            if (phone == null) return (false, "Enter a valid phone number: 11 digits starting with 0, or +92.", "phone");

            string? secondary = null;
            if (!string.IsNullOrWhiteSpace(dto.SecondaryPhone))
            {
                secondary = NormalizePhone(dto.SecondaryPhone);
                if (secondary == null) return (false, "Enter a valid phone number: 11 digits starting with 0, or +92.", "secondaryPhone");
            }

            var bio = string.IsNullOrWhiteSpace(dto.Bio) ? null : dto.Bio.Trim();
            if (bio != null && bio.Length > 300) return (false, "The bio can be at most 300 characters.", "bio");

            // Reset links go to the email, so changing it needs the password too.
            var emailChanged = !string.Equals(email, user.Email, StringComparison.OrdinalIgnoreCase);
            if (emailChanged && emailNeedsPassword)
            {
                if (string.IsNullOrEmpty(dto.CurrentPassword))
                    return (false, "Enter your current password to change the email.", "currentPassword");
                if (!BCrypt.Net.BCrypt.Verify(dto.CurrentPassword, user.PasswordHash))
                    return (false, "Your current password is incorrect.", "currentPassword");
            }

            user.FullName = fullName;
            user.Email = email;
            user.Phone = Fit(dto.Phone!.Trim(), phone);
            user.SecondaryPhone = secondary == null ? null : Fit(dto.SecondaryPhone!.Trim(), secondary);
            user.Bio = bio;
            user.UpdatedAt = DateTime.Now;

            await _context.SaveChangesAsync();

            if (emailChanged) await DeleteUnusedResetLinksAsync(userId);
            return (true, "Profile updated successfully.", null);
        }

        // Keeps the number as typed when it fits the column (15), otherwise its plain digits.
        private static string Fit(string typed, string normalized) => typed.Length <= 15 ? typed : normalized;

        private Task DeleteUnusedResetLinksAsync(int userId) =>
            _context.PasswordResets.Where(r => r.UserID == userId && r.UsedAt == null).ExecuteDeleteAsync();

        // A Pakistani number as typed (0300-1234567, +92 300 1234567), or null when it is not one.
        private static string? NormalizePhone(string? value)
        {
            if (string.IsNullOrWhiteSpace(value)) return null;
            var raw = Regex.Replace(value.Trim(), @"[\s-]", "");
            if (raw.StartsWith("+92")) raw = "0" + raw[3..];
            return Regex.IsMatch(raw, @"^0\d{10}$") ? raw : null;
        }

        // Change password after verifying the current one. Every other device is signed out;
        // this one (currentLoginId) stays signed in.
        public async Task<(bool Success, string Message, string? Field)> ChangePasswordAsync(int userId, ChangePasswordDto dto, int? currentLoginId)
        {
            var user = await _context.Users.FindAsync(userId);
            if (user == null) return (false, "User not found.", null);

            if (string.IsNullOrEmpty(dto.CurrentPassword))
                return (false, "Enter your current password.", "current");

            var passwordError = PasswordPolicy.Validate(dto.NewPassword);
            if (passwordError != null)
                return (false, passwordError, "next");

            if (!BCrypt.Net.BCrypt.Verify(dto.CurrentPassword ?? "", user.PasswordHash))
                return (false, "Your current password is incorrect.", "current");

            if (BCrypt.Net.BCrypt.Verify(dto.NewPassword, user.PasswordHash))
                return (false, "New password must be different from your current password.", "next");

            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.NewPassword);
            user.UpdatedAt = DateTime.Now;

            await _context.SaveChangesAsync();
            await DeleteUnusedResetLinksAsync(userId);

            var others = await _sessions.EndAllAsync(userId, currentLoginId, SessionEndReasons.PasswordChanged);
            return (true, others > 0
                ? $"Password changed. {others} other device{(others == 1 ? " was" : "s were")} signed out."
                : "Password changed successfully.", null);
        }

        // Changing the username needs the current password again.
        public async Task<(bool Success, string? Error)> ChangeUsernameAsync(int userId, ChangeUsernameDto dto)
        {
            var user = await _context.Users.FindAsync(userId);
            if (user == null) return (false, "User not found.");

            if (!BCrypt.Net.BCrypt.Verify(dto.CurrentPassword, user.PasswordHash))
                return (false, "Password is incorrect.");

            var newUsername = dto.NewUsername.Trim();

            if (newUsername.Length < 3)
                return (false, "Username must be at least 3 characters.");
            if (newUsername.Contains(" "))
                return (false, "Username cannot contain spaces.");

            var taken = await _context.Users
                .AnyAsync(u => u.Username == newUsername && u.UserID != userId);
            if (taken) return (false, "That username is already taken.");

            if (user.Username == newUsername)
                return (false, "That's already your username.");

            user.Username = newUsername;
            user.UpdatedAt = DateTime.Now;
            await _context.SaveChangesAsync();

            // The username is inside every token: all devices sign in again with the new one.
            await _sessions.EndAllAsync(userId, null, SessionEndReasons.AccountChanged);
            return (true, null);
        }

        // Asks for the password again before sensitive actions.
        public async Task<bool> VerifyPasswordAsync(int userId, string password)
        {
            var user = await _context.Users.FindAsync(userId);
            if (user == null) return false;
            return BCrypt.Net.BCrypt.Verify(password, user.PasswordHash);
        }

        // The picture is stored as a Base64 data URL. Only small PNG, JPG or WebP images are
        // accepted: the settings page always sends a 400x400 JPG, and every user list loads it.
        private const int MaxPictureLength = 400_000;
        private static readonly string[] PicturePrefixes =
            { "data:image/png;base64,", "data:image/jpeg;base64,", "data:image/jpg;base64,", "data:image/webp;base64," };

        public async Task<(bool Success, string Message)> UpdatePictureAsync(int userId, string? base64Image)
        {
            var picture = string.IsNullOrWhiteSpace(base64Image) ? null : base64Image.Trim();
            if (picture != null)
            {
                var prefix = PicturePrefixes.FirstOrDefault(p => picture.StartsWith(p, StringComparison.OrdinalIgnoreCase));
                if (prefix == null) return (false, "The picture must be a PNG, JPG or WebP image.");
                if (picture.Length > MaxPictureLength) return (false, "The picture is too large. Use a smaller image.");
                var data = picture[prefix.Length..];
                if (!Convert.TryFromBase64String(data, new byte[data.Length], out _))
                    return (false, "The picture could not be read.");
            }

            var user = await _context.Users.FindAsync(userId);
            if (user == null) return (false, "User not found.");

            user.ProfilePicture = picture;
            user.UpdatedAt = DateTime.Now;

            await _context.SaveChangesAsync();
            return (true, "Profile picture updated.");
        }
    }
}