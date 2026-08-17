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

        public PendingActionService(
            IPendingActionRepository repository,
            IClientRepository clientRepository,
            IEmployeeRepository employeeRepository)
        {
            _repository = repository;
            _clientRepository = clientRepository;
            _employeeRepository = employeeRepository;
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
