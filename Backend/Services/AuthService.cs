using Backend.Auth;
using Backend.Data;
using Backend.Models.DTOs;
using Backend.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace Backend.Services
{
    // Handles registration and login logic
    public class AuthService : IAuthService
    {
        private readonly AppDbContext _context;
        private readonly TokenService _tokenService;
        private readonly Backend.Services.INotificationService _notificationService;

        public AuthService(AppDbContext context, TokenService tokenService, Backend.Services.INotificationService notificationService)
        {
            _context = context;
            _tokenService = tokenService;
            _notificationService = notificationService;
        }

        // Register a new user
        public async Task<AuthResponseDto?> RegisterAsync(RegisterDto dto)
        {
            // Check if username already exists
            var exists = await _context.Users
                .AnyAsync(u => u.Username == dto.Username);
            if (exists) return null; // username taken

            // Hash the password using BCrypt (never store the real password)
            var passwordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password);

            // Build the new user
            var user = new User
            {
                Username = dto.Username,
                PasswordHash = passwordHash,
                Email = dto.Email,
                FullName = dto.FullName,
                Role = dto.Role,
                Phone = dto.Phone,
                IsActive = true,
                CreatedAt = DateTime.Now,
                UpdatedAt = DateTime.Now
            };

            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            // Create a token and return the response
            return BuildAuthResponse(user);
        }

        // Log in an existing user.
        // Returns a tuple so the controller can show a specific message
        // (e.g. a disabled account is different from wrong credentials).
        public async Task<(bool Success, string? Error, AuthResponseDto? Data)> LoginAsync(LoginDto dto)
        {
            // Find the user by username
            var user = await _context.Users
                .FirstOrDefaultAsync(u => u.Username == dto.Username);

            // User not found -> generic message (don't reveal which part was wrong)
            if (user == null)
                return (false, "Invalid username or password.", null);

            // Verify the password against the stored hash (BCrypt)
            var passwordOk = BCrypt.Net.BCrypt.Verify(dto.Password, user.PasswordHash);
            if (!passwordOk)
                return (false, "Invalid username or password.", null);

            // Credentials are correct, but the account is disabled
            if (!user.IsActive)
                return (false, "Your account is disabled. Please contact administration.", null);

            // Update last login time
            user.LastLogin = DateTime.Now;
            await _context.SaveChangesAsync();

            // Record a login notification for the user
            await _notificationService.NotifyPersonalAsync(
                user.UserID, LoginNotification.Category, LoginNotification.Title,
                LoginNotification.Message(DateTime.Now));

            return (true, null, BuildAuthResponse(user));
        }

        // Helper: build the auth response (token + basic user info)
        private AuthResponseDto BuildAuthResponse(User user)
        {
            var token = _tokenService.CreateToken(user);
            return new AuthResponseDto
            {
                Token = token,
                UserID = user.UserID,
                Username = user.Username,
                FullName = user.FullName,
                Role = user.Role,
                ProfilePicture = user.ProfilePicture
            };
        }
    }
}
