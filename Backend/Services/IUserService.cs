using Backend.Models.DTOs;

namespace Backend.Services
{
    public interface IUserService
    {
        Task<List<UserDto>> GetAllUsersAsync();
        Task<UserDto?> GetUserByIdAsync(int id);
        Task<(bool Success, string? Error, UserDto? User)> CreateUserAsync(CreateUserDto dto);
        // keepLoginId: when admins edit their own account, the session they are using stays signed in.
        Task<(bool Success, string? Error, UserDto? User)> UpdateUserAsync(int id, CreateUserDto dto, int? keepLoginId);
        Task<(bool Success, string? Error)> DeleteUserAsync(int id, int currentUserId);
        Task<(bool Success, string? Error)> ToggleStatusAsync(int id, int currentUserId);

        // Sessions and sign-in history of one user, and "Sign out everywhere" (admin, Users page)
        Task<SecurityOverviewDto?> GetSecurityAsync(int id);
        Task<(bool Success, string? Error, int Ended)> SignOutEverywhereAsync(int id, int currentUserId);
    }
}