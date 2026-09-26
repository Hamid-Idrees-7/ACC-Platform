using Backend.Models.DTOs;
using Backend.Models.Entities;
using Backend.Repositories;

namespace Backend.Services
{
    public class PendingActionService : IPendingActionService
    {
        private readonly IPendingActionRepository _repository;
        private readonly IClientRepository _clientRepository;
        private readonly IEmployeeRepository _employeeRepository;
        private readonly IMaterialRepository _materialRepository;
        private readonly IProjectRepository _projectRepository;
        private readonly IAssignmentRepository _assignmentRepository;
        private readonly IProjectService _projectService;
        private readonly IProjectExpenseService _expenseService;
        private readonly INotificationService _notificationService;

        public PendingActionService(
            IPendingActionRepository repository,
            IClientRepository clientRepository,
            IEmployeeRepository employeeRepository,
            IMaterialRepository materialRepository,
            IProjectRepository projectRepository,
            IAssignmentRepository assignmentRepository,
            IProjectService projectService,
            IProjectExpenseService expenseService,
            INotificationService notificationService)
        {
            _repository = repository;
            _clientRepository = clientRepository;
            _employeeRepository = employeeRepository;
            _materialRepository = materialRepository;
            _projectRepository = projectRepository;
            _assignmentRepository = assignmentRepository;
            _projectService = projectService;
            _expenseService = expenseService;
            _notificationService = notificationService;
        }

        public async Task<List<PendingActionDto>> GetAllAsync()
        {
            var list = await _repository.GetAllAsync();
            return list.Select(ToDto).ToList();
        }

        public async Task<List<PendingActionDto>> GetPendingAsync()
        {
            var list = await _repository.GetPendingAsync();
            return list.Select(ToDto).ToList();
        }

        public async Task<int> GetPendingCountAsync()
        {
            return await _repository.GetPendingCountAsync();
        }

        // Create a new pending request (RequestedBy comes from the token - secure).
        // Returns false if a pending request already exists for this exact item (prevents duplicates).
        public async Task<bool> CreateAsync(CreatePendingActionDto dto, int requestedByUserId, string requestedByName, string requestedByRole)
        {
            // Prevent duplicates: skip if this item already has a pending request
            var alreadyPending = await _repository.HasPendingAsync(dto.Module.Trim(), dto.TargetID);
            if (alreadyPending) return false;

            var action = new PendingAction
            {
                RequestedByUserID = requestedByUserId,
                RequestedByName = requestedByName,
                RequestedByRole = requestedByRole,
                Module = dto.Module.Trim(),
                Action = dto.Action.Trim(),
                TargetID = dto.TargetID,
                TargetName = dto.TargetName?.Trim() ?? "",
                Status = "Pending",
                CreatedAt = DateTime.Now
            };
            await _repository.AddAsync(action);

            // Notify the requester that their request was sent
            await _notificationService.NotifyPersonalAsync(
                requestedByUserId, "Approval", "Request sent",
                $"You sent a request to {dto.Action.ToLower()} {dto.Module.TrimEnd('s').ToLower()}: {dto.TargetName}.");

            // Notify admins of the new request (audit) and ping any non-admin manager who can
            // resolve approvals (personal, so it reaches their notification bell).
            var newMsg = $"{requestedByName} requested to {dto.Action.ToLower()} {dto.Module.TrimEnd('s').ToLower()}: {dto.TargetName}.";
            await _notificationService.NotifyAdminsActivityAsync(
                "Approval", "New approval request", newMsg);
            await _notificationService.NotifyPermissionHoldersAsync(
                "Approvals", "Manage", "Approval", "New approval request", newMsg,
                excludeUserId: requestedByUserId);

            return true;
        }

        // Approve or reject. On approval, the actual action is performed.
        // resolverUserId / resolverName identify who resolved it, for the admin audit feed.
        public async Task<(bool, string?)> ResolveAsync(int id, ResolvePendingActionDto dto, int resolverUserId, string resolverName)
        {
            var action = await _repository.GetByIdAsync(id);
            if (action == null) return (false, "Request not found.");
            if (action.Status != "Pending") return (false, "This request has already been resolved.");
            // Conflict-of-interest guard: nobody can resolve a request they raised themselves.
            if (action.RequestedByUserID == resolverUserId)
                return (false, "You can't resolve your own request.");

            var status = dto.Status?.Trim();
            if (status != "Approved" && status != "Rejected")
                return (false, "Invalid status.");

            // If approved, run the actual action now
            if (status == "Approved")
            {
                var performError = await PerformActionAsync(action);
                if (performError != null)
                    return (false, performError);
            }

            action.Status = status;
            action.Reason = dto.Reason?.Trim();
            action.ResolvedAt = DateTime.Now;
            await _repository.UpdateAsync(action);

            // Notify the original requester of the outcome
            var verb = status == "Approved" ? "approved" : "rejected";
            await _notificationService.NotifyPersonalAsync(
                action.RequestedByUserID, "Approval", $"Request {verb}",
                $"Your request to {action.Action.ToLower()} {action.Module.TrimEnd('s').ToLower()}: {action.TargetName} was {verb}.",
                action.Reason);

            // Record who resolved it in the admin audit feed (skip the actor's own copy).
            var who = string.IsNullOrWhiteSpace(resolverName) ? "A reviewer" : resolverName;
            await _notificationService.NotifyAdminsActivityAsync(
                "Approval", $"Approval request {verb}",
                $"{who} {verb} {action.RequestedByName}'s request to {action.Action.ToLower()} {action.Module.TrimEnd('s').ToLower()}: {action.TargetName}.",
                excludeUserId: resolverUserId);

            return (true, null);
        }

        // Runs the approved action against the correct module.
        // Returns null on success, or the reason it could not be done. The same safety rules as a
        // direct delete are checked again here, because things can change while a request waits.
        private async Task<string?> PerformActionAsync(PendingAction action)
        {
            const string gone = "Could not complete the action. The item may no longer exist.";

            // Currently only Delete is supported for approval
            if (action.Action != "Delete") return gone;

            switch (action.Module)
            {
                case "Clients":
                    return await _clientRepository.DeleteAsync(action.TargetID) ? null : gone;
                case "Employees":
                    return await _employeeRepository.DeleteAsync(action.TargetID) ? null : gone;
                case "Materials":
                    return await _materialRepository.DeleteAsync(action.TargetID) ? null : gone;
                case "Projects":
                {
                    var blocker = await _projectService.GetDeleteBlockerAsync(action.TargetID);
                    if (blocker != null) return blocker;
                    return await _projectRepository.DeleteAsync(action.TargetID) ? null : gone;
                }
                case "Assignments":
                    return await _assignmentRepository.DeleteAsync(action.TargetID) ? null : gone;
                case "Expenses":
                {
                    var blocker = await _expenseService.GetDeleteBlockerAsync(action.TargetID);
                    if (blocker != null) return blocker;
                    return await _expenseService.DeleteAsync(action.TargetID) ? null : gone;
                }
                default:
                    return gone;
            }
        }

        public async Task<bool> DeleteAsync(int id)
        {
            return await _repository.DeleteAsync(id);
        }

        public async Task DeleteAllAsync()
        {
            await _repository.DeleteAllAsync();
        }

        private PendingActionDto ToDto(PendingAction p) => new PendingActionDto
        {
            PendingActionID = p.PendingActionID,
            RequestedByUserID = p.RequestedByUserID,
            RequestedByName = p.RequestedByName,
            RequestedByRole = p.RequestedByRole,
            Module = p.Module,
            Action = p.Action,
            TargetID = p.TargetID,
            TargetName = p.TargetName,
            Status = p.Status,
            Reason = p.Reason,
            CreatedAt = p.CreatedAt,
            ResolvedAt = p.ResolvedAt
        };
    }
}
