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

        public AuthService(AppDbContext context, TokenService tokenService)
        {
            _context = context;
            _tokenService = tokenService;
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

        // Log in an existing user
        public async Task<AuthResponseDto?> LoginAsync(LoginDto dto)
        {
            // Find the user by username
            var user = await _context.Users
                .FirstOrDefaultAsync(u => u.Username == dto.Username);

            // If user not found, or inactive, fail
            if (user == null || !user.IsActive) return null;

            // Verify the password against the stored hash (BCrypt)
            var passwordOk = BCrypt.Net.BCrypt.Verify(dto.Password, user.PasswordHash);
            if (!passwordOk) return null; // wrong password

            // Update last login time
            user.LastLogin = DateTime.Now;
            await _context.SaveChangesAsync();

            return BuildAuthResponse(user);
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