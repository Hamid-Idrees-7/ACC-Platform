using Backend.Data;
using Backend.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace Backend.Repositories
{
    public class PendingActionRepository : IPendingActionRepository
    {
        private readonly AppDbContext _context;

        public PendingActionRepository(AppDbContext context)
        {
            _context = context;
        }

        // Newest first
        public async Task<List<PendingAction>> GetAllAsync()
        {
            return await _context.PendingActions
                .OrderByDescending(p => p.PendingActionID)
                .ToListAsync();
        }

        // Pending only, newest first
        public async Task<List<PendingAction>> GetPendingAsync()
        {
            return await _context.PendingActions
                .Where(p => p.Status == "Pending")
                .OrderByDescending(p => p.PendingActionID)
                .ToListAsync();
        }

        public async Task<PendingAction?> GetByIdAsync(int id)
        {
            return await _context.PendingActions.FindAsync(id);
        }

        public async Task AddAsync(PendingAction action)
        {
            _context.PendingActions.Add(action);
            await _context.SaveChangesAsync();
        }

        public async Task UpdateAsync(PendingAction action)
        {
            _context.PendingActions.Update(action);
            await _context.SaveChangesAsync();
        }

        // Moves a request from Pending to Processing in one statement. Only one caller can win.
        public async Task<bool> TryClaimAsync(int id)
        {
            var rows = await _context.PendingActions
                .Where(p => p.PendingActionID == id && p.Status == "Pending")
                .ExecuteUpdateAsync(s => s.SetProperty(p => p.Status, "Processing"));
            return rows == 1;
        }

        // Puts a claimed request back to Pending when the approved action could not run.
        public async Task ReleaseClaimAsync(int id)
        {
            await _context.PendingActions
                .Where(p => p.PendingActionID == id && p.Status == "Processing")
                .ExecuteUpdateAsync(s => s.SetProperty(p => p.Status, "Pending"));
        }

        public async Task<bool> DeleteAsync(int id)
        {
            var action = await _context.PendingActions.FindAsync(id);
            if (action == null) return false;

            _context.PendingActions.Remove(action);
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task DeleteAllAsync()
        {
            var all = await _context.PendingActions.ToListAsync();
            if (all.Any())
            {
                _context.PendingActions.RemoveRange(all);
                await _context.SaveChangesAsync();
            }
        }

        // For the dashboard card badge
        public async Task<int> GetPendingCountAsync()
        {
            return await _context.PendingActions
                .CountAsync(p => p.Status == "Pending");
        }

        // Stops a second request for the same item
        public async Task<bool> HasPendingAsync(string module, int targetID)
        {
            return await _context.PendingActions
                .AnyAsync(p => p.Module == module && p.TargetID == targetID && p.Status == "Pending");
        }
    }
}
