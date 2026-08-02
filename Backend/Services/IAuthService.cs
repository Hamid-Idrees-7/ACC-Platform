using Backend.Models.DTOs;

namespace Backend.Services
{
    // Contract for authentication (register + login)
    public interface IAuthService
    {
        // Register a new user; returns auth response, or null if username already taken
        Task<AuthResponseDto?> RegisterAsync(RegisterDto dto);

        // Log in; returns auth response, or null if credentials are wrong
        Task<AuthResponseDto?> LoginAsync(LoginDto dto);
    }
}