using Backend.Data;
using Backend.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace Backend.Repositories
{
    public class PermissionRepository : IPermissionRepository
    {
        private readonly AppDbContext _context;

        public PermissionRepository(AppDbContext context)
        {
            _context = context;
        }

        public async Task<List<UserPermission>> GetByUserAsync(int userId)
        {
            return await _context.UserPermissions
                .Where(p => p.UserID == userId)
                .ToListAsync();
        }

        public async Task<UserPermission?> GetOneAsync(int userId, string module, string action)
        {
            return await _context.UserPermissions
                .FirstOrDefaultAsync(p => p.UserID == userId && p.Module == module && p.Action == action);
        }

        // Everyone's permissions (eg for counts)
        public async Task<List<UserPermission>> GetAllAsync()
        {
            return await _context.UserPermissions.ToListAsync();
        }

        public async Task AddAsync(UserPermission permission)
        {
            _context.UserPermissions.Add(permission);
            await _context.SaveChangesAsync();
        }

        public async Task<bool> TryAddAsync(UserPermission permission)
        {
            _context.UserPermissions.Add(permission);
            try
            {
                await _context.SaveChangesAsync();
                return true;
            }
            catch (DbUpdateException)
            {
                // The unique (user, module, action) index: saved by a quick second click.
                _context.Entry(permission).State = EntityState.Detached;
                return false;
            }
        }

        public async Task UpdateAsync(UserPermission permission)
        {
            _context.UserPermissions.Update(permission);
            await _context.SaveChangesAsync();
        }

        // Called when a user is deleted
        public async Task DeleteAllForUserAsync(int userId)
        {
            var perms = await _context.UserPermissions
                .Where(p => p.UserID == userId)
                .ToListAsync();

            if (perms.Any())
            {
                _context.UserPermissions.RemoveRange(perms);
                await _context.SaveChangesAsync();
            }
        }
    }
}