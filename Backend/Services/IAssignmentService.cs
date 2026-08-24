using Backend.Models.DTOs;

namespace Backend.Services
{
    public interface IAssignmentService
    {
        Task<List<AssignmentDto>> GetAllAsync();
        Task<AssignmentDto?> GetByIdAsync(int id);
        Task<AssignmentDto> CreateAsync(CreateAssignmentDto dto);
        Task<AssignmentDto?> UpdateAsync(int id, CreateAssignmentDto dto);
        Task<bool> DeleteAsync(int id);
        Task<AssignmentDto?> EndAsync(int id);
    }
}
