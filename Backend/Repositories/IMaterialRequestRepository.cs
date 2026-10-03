using Backend.Models.Entities;

namespace Backend.Repositories
{
    public interface IMaterialRequestRepository
    {
        Task<MaterialRequest> AddAsync(MaterialRequest request);
        Task<List<MaterialRequest>> GetAllAsync();
        Task<List<MaterialRequest>> GetByUserAsync(int userId);
        Task<MaterialRequest?> GetByIdAsync(int id);
        Task UpdateAsync(MaterialRequest request);

        // Moves a request from Pending to Processing in one statement; only one caller wins.
        Task<bool> TryClaimAsync(int id);
        Task ReleaseClaimAsync(int id);
        Task<bool> DeleteAsync(int id);
        Task<int> CountPendingAsync();
    }
}
