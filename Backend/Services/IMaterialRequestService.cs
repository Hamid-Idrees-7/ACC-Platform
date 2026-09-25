using Backend.Models.DTOs;

namespace Backend.Services
{
    public interface IMaterialRequestService
    {
        // Admin: all requests (pending first is handled in the UI), with names resolved.
        Task<List<MaterialRequestDto>> GetAllAsync();
        Task<int> GetPendingCountAsync();

        // Field: the requests a single engineer raised, and creating a new one.
        Task<List<MaterialRequestDto>> GetForUserAsync(int userId);
        Task<MaterialRequestDto> CreateAsync(int userId, int projectId, CreateMaterialRequestDto dto);
        Task<(bool Success, string? Error)> DeleteOwnPendingAsync(int userId, int requestId);

        // Approve to issues the stock to the project (auto-costed). Returns an error string
        // if the material is short or the request is already resolved.
        Task<(bool Success, string? Error)> ApproveAsync(int requestId, int adminUserId);
        Task<(bool Success, string? Error)> RejectAsync(int requestId, int adminUserId, string? note);
    }
}
