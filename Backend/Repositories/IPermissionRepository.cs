using Backend.Models.Entities;

namespace Backend.Repositories
{
    public interface IPermissionRepository
    {
        Task<List<UserPermission>> GetByUserAsync(int userId);
        Task<UserPermission?> GetOneAsync(int userId, string module, string action);
        Task<List<UserPermission>> GetAllAsync();
        Task AddAsync(UserPermission permission);

        // Adds the row unless the same toggle was saved at the same moment; false then.
        Task<bool> TryAddAsync(UserPermission permission);
        Task UpdateAsync(UserPermission permission);
        Task DeleteAllForUserAsync(int userId);
    }
}