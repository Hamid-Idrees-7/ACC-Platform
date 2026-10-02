using Backend.Models.DTOs;

namespace Backend.Services
{
    public interface IProfileService
    {
        Task<ProfileDto?> GetProfileAsync(int userId);
        Task<bool> VerifyPasswordAsync(int userId, string password);
        // Field names the input that failed (fullName, email, phone...), so the page can show the message under it.
        Task<(bool Success, string Message, string? Field)> UpdateProfileAsync(int userId, UpdateProfileDto dto, bool emailNeedsPassword);
        Task<(bool Success, string Message)> UpdatePictureAsync(int userId, string? base64Image);
        Task<(bool Success, string Message, string? Field)> ChangePasswordAsync(int userId, ChangePasswordDto dto, int? currentLoginId);
        Task<(bool Success, string? Error)> ChangeUsernameAsync(int userId, ChangeUsernameDto dto);

    }
}