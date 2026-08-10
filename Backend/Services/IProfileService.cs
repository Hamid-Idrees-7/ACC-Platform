using Backend.Models.DTOs;

namespace Backend.Services
{
    public interface IProfileService
    {
        Task<ProfileDto?> GetProfileAsync(int userId);
        Task<(bool Success, string Message)> UpdateProfileAsync(int userId, UpdateProfileDto dto);
        Task<(bool Success, string Message)> UpdatePictureAsync(int userId, string? base64Image);
        Task<(bool Success, string Message)> ChangePasswordAsync(int userId, ChangePasswordDto dto);
    }
}