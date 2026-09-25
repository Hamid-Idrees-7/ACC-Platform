using Backend.Models.DTOs;

namespace Backend.Services
{
    public interface IPendingActionService
    {
        Task<List<PendingActionDto>> GetAllAsync();
        Task<List<PendingActionDto>> GetPendingAsync();
        Task<int> GetPendingCountAsync();
        Task<bool> CreateAsync(CreatePendingActionDto dto, int requestedByUserId, string requestedByName, string requestedByRole);
        Task<(bool Success, string? Error)> ResolveAsync(int id, ResolvePendingActionDto dto, int resolverUserId, string resolverName);
        Task<bool> DeleteAsync(int id);
        Task DeleteAllAsync();
    }
}
