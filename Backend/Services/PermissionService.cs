using Backend.Models.DTOs;
using Backend.Models.Entities;
using Backend.Repositories;

namespace Backend.Services
{
    public class PermissionService : IPermissionService
    {
        private readonly IPermissionRepository _repository;

        public PermissionService(IPermissionRepository repository)
        {
            _repository = repository;
        }

        // Get all saved permissions for a user
        public async Task<List<PermissionDto>> GetUserPermissionsAsync(int userId)
        {
            var perms = await _repository.GetByUserAsync(userId);
            return perms.Select(p => new PermissionDto
            {
                Module = p.Module,
                Action = p.Action,
                IsAllowed = p.IsAllowed,
                RequiresApproval = p.RequiresApproval
            }).ToList();
        }

        // Set (create or update) a single permission toggle
        public async Task SetPermissionAsync(SetPermissionDto dto)
        {
            var existing = await _repository.GetOneAsync(dto.UserID, dto.Module, dto.Action);

            if (existing == null)
            {
                // First time this action is toggled - create a row
                await _repository.AddAsync(new UserPermission
                {
                    UserID = dto.UserID,
                    Module = dto.Module.Trim(),
                    Action = dto.Action.Trim(),
                    IsAllowed = dto.IsAllowed,
                    RequiresApproval = dto.RequiresApproval,
                    UpdatedAt = DateTime.Now
                });
            }
            else
            {
                existing.IsAllowed = dto.IsAllowed;
                existing.RequiresApproval = dto.RequiresApproval;
                existing.UpdatedAt = DateTime.Now;
                await _repository.UpdateAsync(existing);
            }
        }

        // How many modules each user has at least one "View" access to (for the "X of 9 modules" count)
        public async Task<Dictionary<int, int>> GetModuleCountsAsync()
        {
            var all = await _repository.GetAllAsync();
            return all
                .Where(p => p.Action == "View" && p.IsAllowed)
                .GroupBy(p => p.UserID)
                .ToDictionary(g => g.Key, g => g.Select(p => p.Module).Distinct().Count());
        }

        // Check if a user is allowed a specific action (used by backend enforcement).
        // View is the baseline: any non-View action ALSO requires View on the module,
        // so an action can never be exploited (e.g. via direct API) without module access.
        public async Task<bool> HasPermissionAsync(int userId, string module, string action)
        {
            var perm = await _repository.GetOneAsync(userId, module, action);
            if (perm == null || !perm.IsAllowed) return false;

            if (!string.Equals(action, "View", StringComparison.OrdinalIgnoreCase))
            {
                var view = await _repository.GetOneAsync(userId, module, "View");
                if (view == null || !view.IsAllowed) return false;
            }

            return true;
        }

        // Check if an allowed action needs approval first
        public async Task<bool> RequiresApprovalAsync(int userId, string module, string action)
        {
            var perm = await _repository.GetOneAsync(userId, module, action);
            return perm != null && perm.IsAllowed && perm.RequiresApproval;
        }
    }
}