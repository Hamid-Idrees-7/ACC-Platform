using Backend.Models.DTOs;
using Backend.Models.Entities;
using Backend.Repositories;

namespace Backend.Services
{
    public class EmployeeService : IEmployeeService
    {
        private readonly IEmployeeRepository _repository;
        private readonly IAssignmentRepository _assignmentRepository;

        public EmployeeService(IEmployeeRepository repository, IAssignmentRepository assignmentRepository)
        {
            _repository = repository;
            _assignmentRepository = assignmentRepository;
        }

        public async Task<List<EmployeeDto>> GetAllEmployeesAsync()
        {
            var employees = await _repository.GetAllAsync();
            return employees.Select(ToDto).ToList();
        }

        public async Task<EmployeeDto?> GetEmployeeByIdAsync(int id)
        {
            var employee = await _repository.GetByIdAsync(id);
            return employee == null ? null : ToDto(employee);
        }

        public async Task<EmployeeDto> CreateEmployeeAsync(CreateEmployeeDto dto)
        {
            var employee = new Employee
            {
                FullName = dto.FullName.Trim(),
                Phone = dto.Phone.Trim(),
                SecondaryPhone = dto.SecondaryPhone?.Trim(),
                CNIC = dto.CNIC?.Trim(),
                Email = dto.Email?.Trim(),
                Address = dto.Address?.Trim(),
                City = dto.City?.Trim(),
                Designation = dto.Designation.Trim(),
                JoiningDate = dto.JoiningDate,
                Status = dto.Status,
                CreatedAt = DateTime.Now,
                UpdatedAt = DateTime.Now
            };

            var created = await _repository.AddAsync(employee);
            return ToDto(created);
        }

        public async Task<EmployeeDto?> UpdateEmployeeAsync(int id, CreateEmployeeDto dto)
        {
            var employee = await _repository.GetByIdAsync(id);
            if (employee == null) return null;

            employee.FullName = dto.FullName.Trim();
            employee.Phone = dto.Phone.Trim();
            employee.SecondaryPhone = dto.SecondaryPhone?.Trim();
            employee.CNIC = dto.CNIC?.Trim();
            employee.Email = dto.Email?.Trim();
            employee.Address = dto.Address?.Trim();
            employee.City = dto.City?.Trim();
            employee.Designation = dto.Designation.Trim();
            employee.JoiningDate = dto.JoiningDate;
            employee.Status = dto.Status;
            employee.UpdatedAt = DateTime.Now;

            await _repository.UpdateAsync(employee);
            return ToDto(employee);
        }

        public async Task<bool> DeleteEmployeeAsync(int id)
        {
            return await _repository.DeleteAsync(id);
        }

        // True if the employee has ever been assigned to a project. Such a record
        // is referenced by assignment history and must not be deleted outright.
        public async Task<bool> HasAssignmentsAsync(int id)
        {
            return await _assignmentRepository.AnyForEmployeeAsync(id);
        }

        // Convert entity to DTO
        private EmployeeDto ToDto(Employee e)
        {
            return new EmployeeDto
            {
                EmployeeID = e.EmployeeID,
                FullName = e.FullName,
                Phone = e.Phone,
                SecondaryPhone = e.SecondaryPhone,
                CNIC = e.CNIC,
                Email = e.Email,
                Address = e.Address,
                City = e.City,
                Designation = e.Designation,
                JoiningDate = e.JoiningDate,
                Status = e.Status,
                CreatedAt = e.CreatedAt
            };
        }
    }
}