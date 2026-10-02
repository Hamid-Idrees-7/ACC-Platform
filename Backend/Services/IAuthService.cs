using Backend.Auth;
using Backend.Models.DTOs;

namespace Backend.Services
{
    // Authentication: sign in, renew the token and sign out.
    public interface IAuthService
    {
        // Sign in; the result carries the auth data, or the status code and message to show
        Task<LoginResult> LoginAsync(LoginDto dto, ClientInfo client);

        // A fresh token for the same session, or null when it has ended or reached its limit
        Task<AuthResponseDto?> RefreshAsync(int userId, int loginId);

        // Ends the session behind the token (idle = signed out after inactivity)
        Task LogoutAsync(int userId, int loginId, bool idle);
    }
}
