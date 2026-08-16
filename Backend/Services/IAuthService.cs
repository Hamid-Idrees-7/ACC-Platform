using Backend.Models.DTOs;

namespace Backend.Services
{
    // Contract for authentication (register + login)
    public interface IAuthService
    {
        // Register a new user; returns auth response, or null if username already taken
        Task<AuthResponseDto?> RegisterAsync(RegisterDto dto);

        // Log in; returns success flag, an optional error message, and the auth data on success
        Task<(bool Success, string? Error, AuthResponseDto? Data)> LoginAsync(LoginDto dto);
    }
}
