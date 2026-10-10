using Backend.Models.Entities;

namespace Backend.Repositories
{
    public interface IAiConversationRepository
    {
        Task<AiConversation> AddAsync(AiConversation conversation);
        Task<List<AiConversation>> GetForUserAsync(int userId);
        Task<AiConversation?> GetByIdAsync(int id, int userId);
        Task UpdateAsync(AiConversation conversation);
        Task<bool> DeleteAsync(int id, int userId);
    }
}
