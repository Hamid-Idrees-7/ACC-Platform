using Backend.Data;
using Backend.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace Backend.Repositories
{
    public class AiConversationRepository : IAiConversationRepository
    {
        private readonly AppDbContext _context;

        public AiConversationRepository(AppDbContext context)
        {
            _context = context;
        }

        public async Task<AiConversation> AddAsync(AiConversation conversation)
        {
            _context.AiConversations.Add(conversation);
            await _context.SaveChangesAsync();
            return conversation;
        }

        public async Task<List<AiConversation>> GetForUserAsync(int userId) =>
            await _context.AiConversations
                .Where(c => c.UserID == userId)
                .OrderByDescending(c => c.UpdatedAt)
                .ToListAsync();

        public async Task<AiConversation?> GetByIdAsync(int id, int userId) =>
            await _context.AiConversations.FirstOrDefaultAsync(c => c.AiConversationID == id && c.UserID == userId);

        public async Task UpdateAsync(AiConversation conversation)
        {
            _context.AiConversations.Update(conversation);
            await _context.SaveChangesAsync();
        }

        public async Task<bool> DeleteAsync(int id, int userId)
        {
            var row = await _context.AiConversations.FirstOrDefaultAsync(c => c.AiConversationID == id && c.UserID == userId);
            if (row == null) return false;
            _context.AiConversations.Remove(row);
            await _context.SaveChangesAsync();
            return true;
        }
    }
}
