using Backend.Models.Entities;

namespace Backend.Repositories
{
    public interface IPendingActionRepository
    {
        // A transaction for several saves that belong together (null if one is already open)
        Task<Microsoft.EntityFrameworkCore.Storage.IDbContextTransaction?> BeginTransactionAsync();

        Task<List<PendingAction>> GetAllAsync();
        Task<List<PendingAction>> GetPendingAsync();
        Task<PendingAction?> GetByIdAsync(int id);
        Task AddAsync(PendingAction action);
        Task UpdateAsync(PendingAction action);
        Task<bool> TryClaimAsync(int id);
        Task ReleaseClaimAsync(int id);
        Task<bool> DeleteAsync(int id);
        Task DeleteAllAsync();
        Task<int> GetPendingCountAsync();
        Task<bool> HasPendingAsync(string module, int targetID);
    }
}
