using Backend.Models.Entities;

namespace Backend.Repositories
{
    public interface IPermissionRepository
    {
        Task<List<UserPermission>> GetByUserAsync(int userId);
        Task<UserPermission?> GetOneAsync(int userId, string module, string action);
        Task<List<UserPermission>> GetAllAsync();
        Task AddAsync(UserPermission permission);
        Task UpdateAsync(UserPermission permission);
        Task DeleteAllForUserAsync(int userId);
    }
}