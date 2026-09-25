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

        public async Task<List<MaterialRequest>> GetByProjectIdsAsync(List<int> projectIds)
        {
            if (projectIds.Count == 0) return new List<MaterialRequest>();
            return await _context.MaterialRequests
                .Where(r => projectIds.Contains(r.ProjectID))
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
