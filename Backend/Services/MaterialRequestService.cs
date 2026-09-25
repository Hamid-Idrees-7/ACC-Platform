using Backend.Models.DTOs;
using Backend.Models.Entities;
using Backend.Repositories;

namespace Backend.Services
{
    public class MaterialRequestService : IMaterialRequestService
    {
        private readonly IMaterialRequestRepository _repository;
        private readonly IMaterialService _materialService;
        private readonly IProjectRepository _projectRepository;
        private readonly IUserRepository _userRepository;
        private readonly INotificationService _notificationService;

        public MaterialRequestService(
            IMaterialRequestRepository repository,
            IMaterialService materialService,
            IProjectRepository projectRepository,
            IUserRepository userRepository,
            INotificationService notificationService)
        {
            _repository = repository;
            _materialService = materialService;
            _projectRepository = projectRepository;
            _userRepository = userRepository;
            _notificationService = notificationService;
        }

        public async Task<List<MaterialRequestDto>> GetAllAsync()
        {
            var requests = await _repository.GetAllAsync();
            return await MapManyAsync(requests);
        }

        public async Task<int> GetPendingCountAsync()
        {
            return await _repository.CountPendingAsync();
        }

        public async Task<List<MaterialRequestDto>> GetForUserAsync(int userId)
        {
            var requests = await _repository.GetByUserAsync(userId);
            return await MapManyAsync(requests);
        }

        public async Task<MaterialRequestDto> CreateAsync(int userId, int projectId, CreateMaterialRequestDto dto)
        {
            var request = await _repository.AddAsync(new MaterialRequest
            {
                ProjectID = projectId,
                PhaseID = dto.PhaseID,
                MaterialID = dto.MaterialID,
                Quantity = dto.Quantity,
                Note = string.IsNullOrWhiteSpace(dto.Note) ? null : dto.Note.Trim(),
                RequestedByUserID = userId,
                Status = "Pending",
                CreatedAt = DateTime.Now
            });

            var mapped = await MapManyAsync(new List<MaterialRequest> { request });
            var m = mapped[0];

            // Tell the admins a new field request is waiting for them (audit feed) and ping any
            // non-admin manager who can act on it (personal, so it hits their bell).
            var newMsg = $"{m.RequestedByName} requested {m.Quantity.ToString("0.##")} {m.Unit} of {m.MaterialName} for {m.ProjectTitle}.";
            await _notificationService.NotifyAdminsActivityAsync(
                "Material Requests", "New material request", newMsg);
            await _notificationService.NotifyPermissionHoldersAsync(
                "MaterialRequests", "Manage", "Material Requests", "New material request", newMsg,
                excludeUserId: userId);

            return m;
        }

        public async Task<(bool Success, string? Error)> DeleteOwnPendingAsync(int userId, int requestId)
        {
            var request = await _repository.GetByIdAsync(requestId);
            if (request == null) return (false, "Request not found.");
            if (request.RequestedByUserID != userId) return (false, "This request isn't yours.");
            if (request.Status != "Pending") return (false, "Only a pending request can be cancelled.");

            await _repository.DeleteAsync(requestId);
            return (true, null);
        }

        public async Task<(bool Success, string? Error)> ApproveAsync(int requestId, int adminUserId)
        {
            var request = await _repository.GetByIdAsync(requestId);
            if (request == null) return (false, "Request not found.");
            if (request.Status != "Pending") return (false, "This request has already been resolved.");
            // Conflict-of-interest guard: nobody can approve a request they raised themselves.
            if (request.RequestedByUserID == adminUserId)
                return (false, "You can't approve your own material request.");

            var project = await _projectRepository.GetByIdAsync(request.ProjectID);

            // Issue the stock to the project — this reuses the material module's issue logic,
            // including its negative-stock block and automatic weighted-average costing.
            var result = await _materialService.IssueAsync(request.MaterialID, new IssueDto
            {
                ProjectName = project?.Title ?? "",
                ProjectID = request.ProjectID,
                PhaseID = request.PhaseID,
                Quantity = request.Quantity,
                Note = "Issued from an approved field request."
            });

            if (!result.Success)
                return (false, result.Error);   // Only 40 Bags available

            request.Status = "Approved";
            request.ResolvedByUserID = adminUserId;
            request.ResolvedAt = DateTime.Now;
            await _repository.UpdateAsync(request);

            // Let the engineer know their request went through and the stock was issued.
            var m = (await MapManyAsync(new List<MaterialRequest> { request }))[0];
            await _notificationService.NotifyPersonalAsync(
                request.RequestedByUserID,
                "Material Requests",
                "Request approved",
                $"Your request for {m.Quantity.ToString("0.##")} {m.Unit} of {m.MaterialName} ({m.ProjectTitle}) was approved and issued to the site.");

            // Record who resolved it in the admin audit feed (skip the actor's own copy).
            var approver = await _userRepository.GetByIdAsync(adminUserId);
            await _notificationService.NotifyAdminsActivityAsync(
                "Material Requests", "Material request approved",
                $"{approver?.FullName ?? "A reviewer"} approved {m.RequestedByName}'s request for {m.Quantity.ToString("0.##")} {m.Unit} of {m.MaterialName} ({m.ProjectTitle}).",
                excludeUserId: adminUserId);

            return (true, null);
        }

        public async Task<(bool Success, string? Error)> RejectAsync(int requestId, int adminUserId, string? note)
        {
            var request = await _repository.GetByIdAsync(requestId);
            if (request == null) return (false, "Request not found.");
            if (request.Status != "Pending") return (false, "This request has already been resolved.");
            // Conflict-of-interest guard: nobody can reject a request they raised themselves.
            if (request.RequestedByUserID == adminUserId)
                return (false, "You can't reject your own material request.");

            request.Status = "Rejected";
            request.ResolveNote = string.IsNullOrWhiteSpace(note) ? null : note.Trim();
            request.ResolvedByUserID = adminUserId;
            request.ResolvedAt = DateTime.Now;
            await _repository.UpdateAsync(request);

            // Let the engineer know it was rejected, carrying the reason if one was given.
            var m = (await MapManyAsync(new List<MaterialRequest> { request }))[0];
            await _notificationService.NotifyPersonalAsync(
                request.RequestedByUserID,
                "Material Requests",
                "Request rejected",
                $"Your request for {m.Quantity.ToString("0.##")} {m.Unit} of {m.MaterialName} ({m.ProjectTitle}) was rejected.",
                reason: request.ResolveNote);

            // Record who resolved it in the admin audit feed (skip the actor's own copy).
            var rejecter = await _userRepository.GetByIdAsync(adminUserId);
            await _notificationService.NotifyAdminsActivityAsync(
                "Material Requests", "Material request rejected",
                $"{rejecter?.FullName ?? "A reviewer"} rejected {m.RequestedByName}'s request for {m.Quantity.ToString("0.##")} {m.Unit} of {m.MaterialName} ({m.ProjectTitle}).",
                excludeUserId: adminUserId);

            return (true, null);
        }

        //  shared mapping (batch-loads the reference data once)
        private async Task<List<MaterialRequestDto>> MapManyAsync(List<MaterialRequest> requests)
        {
            if (requests.Count == 0) return new List<MaterialRequestDto>();

            var materials = await _materialService.GetAllMaterialsAsync();
            var matById = materials.ToDictionary(m => m.MaterialID);
            var projects = await _projectRepository.GetAllAsync();
            var projById = projects.ToDictionary(p => p.ProjectID, p => p.Title);
            var phases = await _projectRepository.GetAllPhasesAsync();
            var phaseById = phases.ToDictionary(p => p.PhaseID, p => p.Name);
            var users = await _userRepository.GetAllAsync();
            var userById = users.ToDictionary(u => u.UserID, u => u.FullName);

            return requests.Select(r =>
            {
                matById.TryGetValue(r.MaterialID, out var mat);
                return new MaterialRequestDto
                {
                    RequestID = r.RequestID,
                    ProjectID = r.ProjectID,
                    ProjectTitle = projById.GetValueOrDefault(r.ProjectID, "—"),
                    PhaseID = r.PhaseID,
                    PhaseName = r.PhaseID.HasValue ? phaseById.GetValueOrDefault(r.PhaseID.Value) : null,
                    MaterialID = r.MaterialID,
                    MaterialName = mat?.Name ?? "—",
                    Unit = mat?.Unit ?? "",
                    Quantity = r.Quantity,
                    Note = r.Note,
                    RequestedByName = userById.GetValueOrDefault(r.RequestedByUserID, "—"),
                    Status = r.Status,
                    ResolveNote = r.ResolveNote,
                    AvailableStock = mat?.CurrentStock ?? 0m,
                    CreatedAt = r.CreatedAt,
                    ResolvedAt = r.ResolvedAt
                };
            }).ToList();
        }
    }
}
