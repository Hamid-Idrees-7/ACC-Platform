using Backend.Models.Entities;

namespace Backend.Repositories
{
    public interface IMaterialRequestRepository
    {
        Task<MaterialRequest> AddAsync(MaterialRequest request);
        Task<List<MaterialRequest>> GetAllAsync();
        Task<List<MaterialRequest>> GetByProjectIdsAsync(List<int> projectIds);
        Task<List<MaterialRequest>> GetByUserAsync(int userId);
        Task<MaterialRequest?> GetByIdAsync(int id);
        Task UpdateAsync(MaterialRequest request);
        Task<bool> DeleteAsync(int id);
        Task<int> CountPendingAsync();
    }
}
