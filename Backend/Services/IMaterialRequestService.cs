using Backend.Models.DTOs;

namespace Backend.Services
{
    public interface IMaterialRequestService
    {
        // Admin: all requests with names filled in (the UI puts pending ones first).
        Task<List<MaterialRequestDto>> GetAllAsync();
        Task<int> GetPendingCountAsync();

        // Field: the requests a single engineer raised, and creating a new one.
        Task<List<MaterialRequestDto>> GetForUserAsync(int userId);
        Task<MaterialRequestDto> CreateAsync(int userId, int projectId, CreateMaterialRequestDto dto);
        Task<(bool Success, string? Error)> DeleteOwnPendingAsync(int userId, int requestId);

        // Approving issues the stock to the project (costed automatically). Returns an error
        // if there is not enough stock or the request is already resolved.
        Task<(bool Success, string? Error)> ApproveAsync(int requestId, int adminUserId);
        Task<(bool Success, string? Error)> RejectAsync(int requestId, int adminUserId, string? note);

        // Rejects a closed project's waiting requests and tells each engineer. Returns how many.
        Task<int> CloseForProjectAsync(int projectId, string reason);
    }
}
