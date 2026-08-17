using Backend.Models.Entities;

namespace Backend.Repositories
{
    public interface IPendingActionRepository
    {
        Task<List<PendingAction>> GetAllAsync();
        Task<List<PendingAction>> GetPendingAsync();
        Task<PendingAction?> GetByIdAsync(int id);
        Task AddAsync(PendingAction action);
        Task UpdateAsync(PendingAction action);
        Task<bool> DeleteAsync(int id);
        Task DeleteAllAsync();
        Task<int> GetPendingCountAsync();
        Task<bool> HasPendingAsync(string module, int targetID);
    }
}
