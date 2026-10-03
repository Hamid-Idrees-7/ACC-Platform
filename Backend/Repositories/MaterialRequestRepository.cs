using Backend.Data;
using Backend.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace Backend.Repositories
{
    public class MaterialRequestRepository : IMaterialRequestRepository
    {
        private readonly AppDbContext _context;

        public MaterialRequestRepository(AppDbContext context)
        {
            _context = context;
        }

        public async Task<MaterialRequest> AddAsync(MaterialRequest request)
        {
            _context.MaterialRequests.Add(request);
            await _context.SaveChangesAsync();
            return request;
        }

        public async Task<List<MaterialRequest>> GetAllAsync()
        {
            return await _context.MaterialRequests
                .OrderByDescending(r => r.CreatedAt)
                .ToListAsync();
        }

        public async Task<List<MaterialRequest>> GetByUserAsync(int userId)
        {
            return await _context.MaterialRequests
                .Where(r => r.RequestedByUserID == userId)
                .OrderByDescending(r => r.CreatedAt)
                .ToListAsync();
        }

        public async Task<MaterialRequest?> GetByIdAsync(int id)
        {
            return await _context.MaterialRequests.FindAsync(id);
        }

        public async Task<bool> TryClaimAsync(int id)
        {
            var rows = await _context.MaterialRequests
                .Where(r => r.RequestID == id && r.Status == "Pending")
                .ExecuteUpdateAsync(s => s.SetProperty(r => r.Status, "Processing"));
            return rows == 1;
        }

        public async Task ReleaseClaimAsync(int id)
        {
            await _context.MaterialRequests
                .Where(r => r.RequestID == id && r.Status == "Processing")
                .ExecuteUpdateAsync(s => s.SetProperty(r => r.Status, "Pending"));
        }

        public async Task UpdateAsync(MaterialRequest request)
        {
            _context.MaterialRequests.Update(request);
            await _context.SaveChangesAsync();
        }

        public async Task<bool> DeleteAsync(int id)
        {
            var request = await _context.MaterialRequests.FindAsync(id);
            if (request == null) return false;
            _context.MaterialRequests.Remove(request);
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<int> CountPendingAsync()
        {
            return await _context.MaterialRequests.CountAsync(r => r.Status == "Pending");
        }
    }
}
