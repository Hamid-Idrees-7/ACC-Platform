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
    }
}