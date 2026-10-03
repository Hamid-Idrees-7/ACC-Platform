using Backend.Models.DTOs;

namespace Backend.Services
{
    public interface IAssignmentService
    {
        Task<List<AssignmentDto>> GetAllAsync();
        Task<AssignmentDto?> GetByIdAsync(int id);
        // Error is the reason it couldn't be saved (shown to the user).
        Task<(AssignmentDto? Assignment, string? Error)> CreateAsync(CreateAssignmentDto dto);
        Task<(AssignmentDto? Assignment, string? Error)> UpdateAsync(int id, CreateAssignmentDto dto);
        Task<bool> DeleteAsync(int id);

        // Why the assignment can't be deleted, or null when it can.
        Task<string?> GetDeleteBlockerAsync(int id);
        Task<AssignmentDto?> EndAsync(int id);
    }
}
