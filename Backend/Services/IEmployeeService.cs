using Backend.Models.DTOs;

namespace Backend.Services
{
    public interface IEmployeeService
    {
        Task<List<EmployeeDto>> GetAllEmployeesAsync();
        Task<EmployeeDto?> GetEmployeeByIdAsync(int id);
        Task<EmployeeDto> CreateEmployeeAsync(CreateEmployeeDto dto);
        Task<EmployeeDto?> UpdateEmployeeAsync(int id, CreateEmployeeDto dto);
        Task<bool> DeleteEmployeeAsync(int id);
        Task<bool> HasAssignmentsAsync(int id);
        Task<string?> GetDeleteBlockerAsync(int id);
        Task<string?> CheckAsync(CreateEmployeeDto dto, int? id);
        Task<IDisposable> LockAsync();
    }
}