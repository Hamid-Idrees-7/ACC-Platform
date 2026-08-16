using Backend.Models.DTOs;

namespace Backend.Services
{
    public interface IPermissionService
    {
        Task<List<PermissionDto>> GetUserPermissionsAsync(int userId);
        Task SetPermissionAsync(SetPermissionDto dto);
        Task<Dictionary<int, int>> GetModuleCountsAsync();
        Task<bool> HasPermissionAsync(int userId, string module, string action);
        Task<bool> RequiresApprovalAsync(int userId, string module, string action);
    }
}