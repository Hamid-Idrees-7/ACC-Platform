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
        private readonly IAttendanceRepository _attendanceRepository;
        private readonly ISalaryRepository _salaryRepository;

        private static readonly string[] WageTypes = { "Daily", "Monthly", "Contract" };
        private static readonly string[] Statuses = { "Active", "Completed" };
        private const decimal MaxWage = 10_000_000_000m;

        public AssignmentService(
            IAssignmentRepository repository,
            IEmployeeRepository employeeRepository,
            IProjectRepository projectRepository,
            IAttendanceRepository attendanceRepository,
            ISalaryRepository salaryRepository)
        {
            _repository = repository;
            _employeeRepository = employeeRepository;
            _projectRepository = projectRepository;
            _attendanceRepository = attendanceRepository;
            _salaryRepository = salaryRepository;
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

        public async Task<(AssignmentDto?, string?)> CreateAsync(CreateAssignmentDto dto)
        {
            var (clean, error) = await ValidateAsync(dto, null);
            if (error != null) return (null, error);

            var employee = await _employeeRepository.GetByIdAsync(dto.EmployeeID);

            var assignment = new Assignment
            {
                EmployeeID = dto.EmployeeID,
                ProjectID = dto.ProjectID,
                Role = (employee?.Designation ?? dto.Role).Trim(),
                WageType = clean.WageType,
                WageAmount = clean.WageAmount,
                StartDate = clean.StartDate,
                EndDate = clean.EndDate,
                Status = clean.Status,
                Notes = dto.Notes?.Trim(),
                CreatedAt = DateTime.Now,
                UpdatedAt = DateTime.Now
            };

            var created = await _repository.AddAsync(assignment);
            return (await ToDtoAsync(created), null);
        }

        public async Task<(AssignmentDto?, string?)> UpdateAsync(int id, CreateAssignmentDto dto)
        {
            var assignment = await _repository.GetByIdAsync(id);
            if (assignment == null) return (null, "Assignment not found.");

            var (clean, error) = await ValidateAsync(dto, assignment);
            if (error != null) return (null, error);

            var employee = await _employeeRepository.GetByIdAsync(dto.EmployeeID);

            assignment.EmployeeID = dto.EmployeeID;
            assignment.ProjectID = dto.ProjectID;
            assignment.Role = (employee?.Designation ?? dto.Role).Trim();
            assignment.WageType = clean.WageType;
            assignment.WageAmount = clean.WageAmount;
            assignment.StartDate = clean.StartDate;
            assignment.EndDate = clean.EndDate;
            assignment.Status = clean.Status;
            assignment.Notes = dto.Notes?.Trim();
            assignment.UpdatedAt = DateTime.Now;

            await _repository.UpdateAsync(assignment);
            return (await ToDtoAsync(assignment), null);
        }

        public async Task<bool> DeleteAsync(int id)
        {
            // Checked again here so an approval accepted later can never remove pay history.
            if (await GetDeleteBlockerAsync(id) != null) return false;
            return await _repository.DeleteAsync(id);
        }

        public async Task<string?> GetDeleteBlockerAsync(int id)
        {
            var assignment = await _repository.GetByIdAsync(id);
            if (assignment == null) return null;
            if (await HasHistoryAsync(assignment))
                return "This assignment has attendance or salary payments, so it can't be deleted. Use End instead, so the history stays.";
            return null;
        }

        // End marks the assignment Completed with today's date as the end date.
        public async Task<AssignmentDto?> EndAsync(int id)
        {
            var assignment = await _repository.GetByIdAsync(id);
            if (assignment == null) return null;

            var today = DateTime.Now.Date;
            assignment.Status = "Completed";
            assignment.EndDate = assignment.StartDate.Date > today ? assignment.StartDate.Date : today;
            assignment.UpdatedAt = DateTime.Now;

            await _repository.UpdateAsync(assignment);
            return await ToDtoAsync(assignment);
        }

        private record CleanAssignment(string WageType, decimal WageAmount, DateTime StartDate, DateTime? EndDate, string Status);

        // The rules every new or edited assignment must follow. existing is null for a new one.
        private async Task<(CleanAssignment, string?)> ValidateAsync(CreateAssignmentDto dto, Assignment? existing)
        {
            var clean = new CleanAssignment("", 0, default, null, "");
            var today = DateTime.Now.Date;

            var wageType = WageTypes.FirstOrDefault(w => w.Equals(dto.WageType?.Trim(), StringComparison.OrdinalIgnoreCase));
            if (wageType == null) return (clean, "Choose a wage type: Daily, Monthly or Contract.");

            var status = Statuses.FirstOrDefault(s => s.Equals(dto.Status?.Trim(), StringComparison.OrdinalIgnoreCase));
            if (status == null) return (clean, "Choose a status: Active or Completed.");

            if (dto.WageAmount <= 0) return (clean, "Enter a wage greater than zero.");
            if (dto.WageAmount > MaxWage) return (clean, "The wage is too large.");
            var wage = Math.Round(dto.WageAmount, 2);

            var start = dto.StartDate.Date;
            if (start.Year < 2000 || start > today.AddYears(5)) return (clean, "Enter a valid start date.");
            var end = dto.EndDate?.Date;
            if (end != null && end < start) return (clean, "The end date can't be before the start date.");

            if (status == "Active" && end != null && end < today)
                return (clean, "An active assignment can't have an end date in the past. Clear the end date, move it forward, or mark the assignment Completed.");
            if (status == "Completed" && end == null)
                end = start > today ? start : today;

            // The employee and project must exist; a new placement needs an active employee and an open project.
            var employee = await _employeeRepository.GetByIdAsync(dto.EmployeeID);
            if (employee == null) return (clean, "Choose an employee.");
            var project = await _projectRepository.GetByIdAsync(dto.ProjectID);
            if (project == null) return (clean, "Choose a project.");

            var employeeChanged = existing == null || existing.EmployeeID != dto.EmployeeID;
            var projectChanged = existing == null || existing.ProjectID != dto.ProjectID;
            if (employeeChanged && employee.Status != "Active")
                return (clean, $"{employee.FullName} is inactive. Set the employee Active first.");
            if (projectChanged && (project.Status == "Completed" || project.Status == "Cancelled"))
                return (clean, $"{project.Title} is {project.Status.ToLower()}, so it can't take new assignments.");

            // The same person can't be placed twice on the same project for the same days.
            var others = (await _repository.GetByProjectAsync(dto.ProjectID))
                .Where(a => a.EmployeeID == dto.EmployeeID && a.AssignmentID != existing?.AssignmentID);
            if (others.Any(a => start <= (a.EndDate?.Date ?? DateTime.MaxValue) && a.StartDate.Date <= (end ?? DateTime.MaxValue)))
                return (clean, $"{employee.FullName} already has an assignment on {project.Title} for these dates. Edit that one instead.");

            // Once attendance or pay exists, the terms that pay is based on are fixed.
            if (existing != null && await HasHistoryAsync(existing))
            {
                if (existing.EmployeeID != dto.EmployeeID || existing.ProjectID != dto.ProjectID ||
                    !existing.WageType.Equals(wageType, StringComparison.OrdinalIgnoreCase) || existing.WageAmount != wage)
                    return (clean, "This assignment already has attendance or salary payments, so the employee, project, wage type and wage can't change. End it and create a new assignment from the change date.");

                var range = await _attendanceRepository.GetDateRangeAsync(existing.AssignmentID);
                if (range != null && start > range.Value.First.Date)
                    return (clean, $"Attendance is marked from {range.Value.First:dd MMM yyyy}, so the start date can't be later than that.");
                if (range != null && end != null && end < range.Value.Last.Date)
                    return (clean, $"Attendance is marked until {range.Value.Last:dd MMM yyyy}, so the end date can't be earlier than that.");
            }

            return (new CleanAssignment(wageType, wage, start, end, status), null);
        }

        // Attendance rows or salary payments that depend on this assignment.
        private async Task<bool> HasHistoryAsync(Assignment a)
        {
            if (await _attendanceRepository.GetDateRangeAsync(a.AssignmentID) != null) return true;
            if (await _salaryRepository.AnyForAssignmentAsync(a.AssignmentID)) return true;
            if (a.WageType != "Monthly") return false;

            // A monthly salary is paid per employee, so look for payments in this assignment's months.
            var from = a.StartDate.Year * 12 + a.StartDate.Month;
            var to = a.EndDate == null ? int.MaxValue : a.EndDate.Value.Year * 12 + a.EndDate.Value.Month;
            return (await _salaryRepository.GetForEmployeeAsync(a.EmployeeID))
                .Any(p => p.SourceType == "Monthly" && p.Year * 12 + p.Month >= from && p.Year * 12 + p.Month <= to);
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
