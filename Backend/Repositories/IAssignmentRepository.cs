using Backend.Models.Entities;

namespace Backend.Repositories
{
    public interface IAssignmentRepository
    {
        Task<List<Assignment>> GetAllAsync();
        Task<Assignment?> GetByIdAsync(int id);
        Task<Assignment> AddAsync(Assignment assignment);
        Task UpdateAsync(Assignment assignment);
        Task<bool> DeleteAsync(int id);

        Task<List<Assignment>> GetByProjectAsync(int projectId);
        Task<bool> AnyForEmployeeAsync(int employeeId);
        Task<decimal> GetContractLabourForProjectAsync(int projectId);
    }
}
