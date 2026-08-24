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
        private readonly INotificationService _notificationService;

        public PendingActionService(
            IPendingActionRepository repository,
            IClientRepository clientRepository,
            IEmployeeRepository employeeRepository,
            IMaterialRepository materialRepository,
            IProjectRepository projectRepository,
            IAssignmentRepository assignmentRepository,
            INotificationService notificationService)
        {
            _repository = repository;
            _clientRepository = clientRepository;
            _employeeRepository = employeeRepository;
            _materialRepository = materialRepository;
            _projectRepository = projectRepository;
            _assignmentRepository = assignmentRepository;
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

            // Notify admins of the new request
            await _notificationService.NotifyAdminsActivityAsync(
                "Approval", "New approval request",
                $"{requestedByName} requested to {dto.Action.ToLower()} {dto.Module.TrimEnd('s').ToLower()}: {dto.TargetName}.");

            return true;
        }

        // Approve or reject. On approval, the actual action is performed.
        public async Task<(bool, string?)> ResolveAsync(int id, ResolvePendingActionDto dto)
        {
            var action = await _repository.GetByIdAsync(id);
            if (action == null) return (false, "Request not found.");
            if (action.Status != "Pending") return (false, "This request has already been resolved.");

            var status = dto.Status?.Trim();
            if (status != "Approved" && status != "Rejected")
                return (false, "Invalid status.");

            // If approved, run the actual action now
            if (status == "Approved")
            {
                var done = await PerformActionAsync(action);
                if (!done)
                    return (false, "Could not complete the action. The item may no longer exist.");
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

            return (true, null);
        }

        // Runs the approved action against the correct module
        private async Task<bool> PerformActionAsync(PendingAction action)
        {
            // Currently only Delete is supported for approval
            if (action.Action == "Delete")
            {
                if (action.Module == "Clients")
                    return await _clientRepository.DeleteAsync(action.TargetID);
                if (action.Module == "Employees")
                    return await _employeeRepository.DeleteAsync(action.TargetID);
                if (action.Module == "Materials")
                    return await _materialRepository.DeleteAsync(action.TargetID);
                if (action.Module == "Projects")
                    return await _projectRepository.DeleteAsync(action.TargetID);
                if (action.Module == "Assignments")
                    return await _assignmentRepository.DeleteAsync(action.TargetID);
            }
            return false;
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
