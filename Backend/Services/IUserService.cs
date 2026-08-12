using Backend.Models.DTOs;

namespace Backend.Services
{
    public interface IUserService
    {
        Task<List<UserDto>> GetAllUsersAsync();
        Task<UserDto?> GetUserByIdAsync(int id);
        Task<(bool Success, string? Error, UserDto? User)> CreateUserAsync(CreateUserDto dto);
        Task<(bool Success, string? Error, UserDto? User)> UpdateUserAsync(int id, CreateUserDto dto);
        Task<(bool Success, string? Error)> DeleteUserAsync(int id, int currentUserId);
        Task<(bool Success, string? Error)> ToggleStatusAsync(int id, int currentUserId);
    }
}