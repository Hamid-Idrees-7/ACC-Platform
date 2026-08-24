using Backend.Models.DTOs;
using Backend.Models.Entities;
using Backend.Repositories;

namespace Backend.Services
{
    public class AssignmentService : IAssignmentService
    {
        private readonly IAssignmentRepository _repository;
        private readonly IEmployeeRepository _employeeRepository;
        private readonly IProjectRepository _projectRepository;

        public AssignmentService(
            IAssignmentRepository repository,
            IEmployeeRepository employeeRepository,
            IProjectRepository projectRepository)
        {
            _repository = repository;
            _employeeRepository = employeeRepository;
            _projectRepository = projectRepository;
        }

        public async Task<List<AssignmentDto>> GetAllAsync()
        {
            var assignments = await _repository.GetAllAsync();
            var employees = (await _employeeRepository.GetAllAsync()).ToDictionary(e => e.EmployeeID);
            var projects = (await _projectRepository.GetAllAsync()).ToDictionary(p => p.ProjectID);

            return assignments.Select(a => MapDto(
                a,
                employees.TryGetValue(a.EmployeeID, out var e) ? e.FullName : "—",
                projects.TryGetValue(a.ProjectID, out var p) ? p.Title : "—")).ToList();
        }

        public async Task<AssignmentDto?> GetByIdAsync(int id)
        {
            var assignment = await _repository.GetByIdAsync(id);
            return assignment == null ? null : await ToDtoAsync(assignment);
        }

        public async Task<AssignmentDto> CreateAsync(CreateAssignmentDto dto)
        {
            var employee = await _employeeRepository.GetByIdAsync(dto.EmployeeID);

            var assignment = new Assignment
            {
                EmployeeID = dto.EmployeeID,
                ProjectID = dto.ProjectID,
                Role = (employee?.Designation ?? dto.Role).Trim(),
                WageType = dto.WageType.Trim(),
                WageAmount = dto.WageAmount,
                StartDate = dto.StartDate,
                EndDate = dto.EndDate,
                Status = dto.Status,
                Notes = dto.Notes?.Trim(),
                CreatedAt = DateTime.Now,
                UpdatedAt = DateTime.Now
            };

            var created = await _repository.AddAsync(assignment);
            return await ToDtoAsync(created);
        }

        public async Task<AssignmentDto?> UpdateAsync(int id, CreateAssignmentDto dto)
        {
            var assignment = await _repository.GetByIdAsync(id);
            if (assignment == null) return null;

            var employee = await _employeeRepository.GetByIdAsync(dto.EmployeeID);

            assignment.EmployeeID = dto.EmployeeID;
            assignment.ProjectID = dto.ProjectID;
            assignment.Role = (employee?.Designation ?? dto.Role).Trim();
            assignment.WageType = dto.WageType.Trim();
            assignment.WageAmount = dto.WageAmount;
            assignment.StartDate = dto.StartDate;
            assignment.EndDate = dto.EndDate;
            assignment.Status = dto.Status;
            assignment.Notes = dto.Notes?.Trim();
            assignment.UpdatedAt = DateTime.Now;

            await _repository.UpdateAsync(assignment);
            return await ToDtoAsync(assignment);
        }

        public async Task<bool> DeleteAsync(int id)
        {
            return await _repository.DeleteAsync(id);
        }

        // End marks the assignment Completed with today's date as the end date.
        public async Task<AssignmentDto?> EndAsync(int id)
        {
            var assignment = await _repository.GetByIdAsync(id);
            if (assignment == null) return null;

            assignment.Status = "Completed";
            assignment.EndDate = DateTime.Now;
            assignment.UpdatedAt = DateTime.Now;

            await _repository.UpdateAsync(assignment);
            return await ToDtoAsync(assignment);
        }

        private async Task<AssignmentDto> ToDtoAsync(Assignment a)
        {
            var employee = await _employeeRepository.GetByIdAsync(a.EmployeeID);
            var project = await _projectRepository.GetByIdAsync(a.ProjectID);
            return MapDto(a, employee?.FullName ?? "—", project?.Title ?? "—");
        }

        private static AssignmentDto MapDto(Assignment a, string employeeName, string projectTitle)
        {
            return new AssignmentDto
            {
                AssignmentID = a.AssignmentID,
                EmployeeID = a.EmployeeID,
                EmployeeName = employeeName,
                ProjectID = a.ProjectID,
                ProjectTitle = projectTitle,
                Role = a.Role,
                WageType = a.WageType,
                WageAmount = a.WageAmount,
                StartDate = a.StartDate,
                EndDate = a.EndDate,
                Status = a.Status,
                Notes = a.Notes,
                CreatedAt = a.CreatedAt
            };
        }
    }
}
