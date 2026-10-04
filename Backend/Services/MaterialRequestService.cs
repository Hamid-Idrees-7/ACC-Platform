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
                CreatedAt = AppTime.Now
            });

            var mapped = await MapManyAsync(new List<MaterialRequest> { request });
            var m = mapped[0];

            // Ping the admins and every manager who can act on it (their bell).
            var newMsg = $"{m.RequestedByName} requested {m.Quantity.ToString("0.##")} {m.Unit} of {m.MaterialName} for {m.ProjectTitle}.";
            await _notificationService.NotifyPermissionHoldersAsync(
                "MaterialRequests", "Manage", "Material Requests", "New material request", newMsg,
                excludeUserId: userId, link: NotificationLinks.MaterialRequest(request.RequestID));

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
            if (project == null) return (false, "This request's project no longer exists. Reject the request instead.");

            // Claim it first, so two people approving (or approving and rejecting) at the same
            // moment can't both act on it.
            if (!await _repository.TryClaimAsync(requestId))
                return (false, "This request has already been resolved.");

            // Issue the stock with the material module's own logic, which blocks negative
            // stock, closed projects and a phase from another project. The request is marked
            // Approved in the same transaction, so stock never goes out with the request left open.
            StockResult result;
            try
            {
                result = await _materialService.IssueAsync(request.MaterialID, new IssueDto
                {
                    ProjectName = project.Title,
                    ProjectID = request.ProjectID,
                    PhaseID = request.PhaseID,
                    Quantity = request.Quantity,
                    Note = "Issued from an approved field request."
                }, async () =>
                {
                    request.Status = "Approved";
                    request.ResolvedByUserID = adminUserId;
                    request.ResolvedAt = AppTime.Now;
                    await _repository.UpdateAsync(request);
                });
            }
            catch
            {
                // Nothing was saved: the request goes back to Pending instead of staying stuck.
                await _repository.ReleaseClaimAsync(requestId);
                throw;
            }

            if (!result.Success)
            {
                await _repository.ReleaseClaimAsync(requestId);
                return (false, result.Error);   // eg "Only 40 Bags available"
            }

            // Let the engineer know their request went through and the stock was issued.
            var m = (await MapManyAsync(new List<MaterialRequest> { request }))[0];
            await _notificationService.NotifyPersonalAsync(
                request.RequestedByUserID,
                "Material Requests",
                "Request approved",
                $"Your request for {m.Quantity.ToString("0.##")} {m.Unit} of {m.MaterialName} ({m.ProjectTitle}) was approved and issued to the site.",
                link: NotificationLinks.MyRequests);

            // Admin audit feed: the stock that went to the site, for every admin.
            var approver = await _userRepository.GetByIdAsync(adminUserId);
            await _notificationService.NotifyAdminsActivityAsync(
                "Material Requests", "Stock issued to site",
                $"{m.Quantity.ToString("0.##")} {m.Unit} of {m.MaterialName} issued to {m.ProjectTitle} for {m.RequestedByName}'s request (approved by {approver?.FullName ?? "a reviewer"}).",
                includeActingUser: true, link: NotificationLinks.MaterialHistory(request.MaterialID));

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

            if (!await _repository.TryClaimAsync(requestId))
                return (false, "This request has already been resolved.");

            var reason = string.IsNullOrWhiteSpace(note) ? null : note.Trim();
            request.Status = "Rejected";
            request.ResolveNote = reason?.Length > 255 ? reason[..255] : reason;
            request.ResolvedByUserID = adminUserId;
            request.ResolvedAt = AppTime.Now;
            try
            {
                await _repository.UpdateAsync(request);
            }
            catch
            {
                await _repository.ReleaseClaimAsync(requestId);
                throw;
            }

            // Let the engineer know it was rejected, carrying the reason if one was given.
            var m = (await MapManyAsync(new List<MaterialRequest> { request }))[0];
            await _notificationService.NotifyPersonalAsync(
                request.RequestedByUserID,
                "Material Requests",
                "Request rejected",
                $"Your request for {m.Quantity.ToString("0.##")} {m.Unit} of {m.MaterialName} ({m.ProjectTitle}) was rejected.",
                reason: request.ResolveNote, link: NotificationLinks.MyRequests);

            // Record who resolved it in the admin audit feed (skip the actor's own copy).
            var rejecter = await _userRepository.GetByIdAsync(adminUserId);
            await _notificationService.NotifyAdminsActivityAsync(
                "Material Requests", "Material request rejected",
                $"{rejecter?.FullName ?? "A reviewer"} rejected {m.RequestedByName}'s request for {m.Quantity.ToString("0.##")} {m.Unit} of {m.MaterialName} ({m.ProjectTitle}).",
                excludeUserId: adminUserId, link: NotificationLinks.MaterialRequest(request.RequestID));

            return (true, null);
        }

        // A project was closed: its waiting requests can never be met, so they are rejected with
        // the reason and each engineer is told. Returns how many were closed.
        public async Task<int> CloseForProjectAsync(int projectId, string reason)
        {
            var waiting = (await _repository.GetAllAsync())
                .Where(r => r.ProjectID == projectId && r.Status == "Pending")
                .ToList();

            int closed = 0;
            foreach (var request in waiting)
            {
                if (!await _repository.TryClaimAsync(request.RequestID)) continue;   // resolved just now

                request.Status = "Rejected";
                request.ResolveNote = reason;
                request.ResolvedAt = AppTime.Now;
                await _repository.UpdateAsync(request);
                closed++;

                var m = (await MapManyAsync(new List<MaterialRequest> { request }))[0];
                await _notificationService.NotifyPersonalAsync(
                    request.RequestedByUserID, "Material Requests", "Request closed",
                    $"Your request for {m.Quantity.ToString("0.##")} {m.Unit} of {m.MaterialName} ({m.ProjectTitle}) was closed.",
                    reason: reason, link: NotificationLinks.MyRequests);
            }
            return closed;
        }

        // Loads the reference data once for the whole list.
        private async Task<List<MaterialRequestDto>> MapManyAsync(List<MaterialRequest> requests)
        {
            if (requests.Count == 0) return new List<MaterialRequestDto>();

            var materials = await _materialService.GetAllMaterialsAsync();
            var matById = materials.ToDictionary(m => m.MaterialID);
            var projects = await _projectRepository.GetAllAsync();
            var projById = projects.ToDictionary(p => p.ProjectID, p => p.Title);
            var phases = await _projectRepository.GetAllPhasesAsync();
            var phaseById = phases.ToDictionary(p => p.PhaseID, p => p.Name);
            var users = await _userRepository.GetAllLightAsync();
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
