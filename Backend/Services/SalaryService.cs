using Backend.Models.DTOs;
using Backend.Models.Entities;
using Backend.Repositories;

namespace Backend.Services
{
    public class SalaryService : ISalaryService
    {
        private readonly IEmployeeRepository _employeeRepository;
        private readonly IAssignmentRepository _assignmentRepository;
        private readonly IProjectRepository _projectRepository;
        private readonly IAttendanceRepository _attendanceRepository;
        private readonly ISalaryRepository _salaryRepository;

        private static readonly string[] MonthNames =
        {
            "", "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"
        };

        public SalaryService(
            IEmployeeRepository employeeRepository,
            IAssignmentRepository assignmentRepository,
            IProjectRepository projectRepository,
            IAttendanceRepository attendanceRepository,
            ISalaryRepository salaryRepository)
        {
            _employeeRepository = employeeRepository;
            _assignmentRepository = assignmentRepository;
            _projectRepository = projectRepository;
            _attendanceRepository = attendanceRepository;
            _salaryRepository = salaryRepository;
        }

        public async Task<SalaryPeriodDto> GetPeriodAsync(int year, int month, int? projectId)
        {
            var monthStart = new DateTime(year, month, 1);
            var monthEnd = monthStart.AddMonths(1).AddDays(-1);
            bool allProjects = projectId == null || projectId == 0;

            var employees = await _employeeRepository.GetAllAsync();
            var employeeById = employees.ToDictionary(e => e.EmployeeID);
            var assignments = await _assignmentRepository.GetAllAsync();
            var projects = await _projectRepository.GetAllAsync();
            var projectNames = projects.ToDictionary(p => p.ProjectID, p => p.Title);

            // Daily attendance for this month, grouped per assignment.
            var dailyIds = assignments.Where(a => a.WageType == "Daily").Select(a => a.AssignmentID).ToList();
            var attendance = await _attendanceRepository.GetByAssignmentIdsAsync(dailyIds);
            var attByAssignment = attendance
                .Where(r => r.Date.Date >= monthStart && r.Date.Date <= monthEnd)
                .GroupBy(r => r.AssignmentID)
                .ToDictionary(g => g.Key, g => g.ToList());

            var payments = await _salaryRepository.GetForPeriodAsync(year, month);

            var cards = new List<EmployeeSalaryDto>();
            var byEmployee = assignments
                .Where(a => Overlaps(a, monthStart, monthEnd))
                .GroupBy(a => a.EmployeeID);

            foreach (var grp in byEmployee)
            {
                var emp = employeeById.GetValueOrDefault(grp.Key);
                if (emp == null) continue;

                var lines = new List<SalaryLineDto>();

                // Monthly — one line per employee (company payroll, not project-specific).
                var monthly = grp.Where(a => a.WageType == "Monthly")
                    .OrderByDescending(a => a.StartDate).FirstOrDefault();
                if (monthly != null && allProjects)
                    lines.Add(BuildLine("Monthly", null, null, "", monthly.WageAmount, 0, 0, monthly.WageAmount, payments, grp.Key));

                // Daily — per assignment, present days in the month × rate.
                foreach (var a in grp.Where(a => a.WageType == "Daily"))
                {
                    if (!allProjects && a.ProjectID != projectId) continue;
                    attByAssignment.TryGetValue(a.AssignmentID, out var recs);
                    int present = recs?.Count(r => r.Status == "Present") ?? 0;
                    int absent = recs?.Count(r => r.Status == "Absent") ?? 0;
                    lines.Add(BuildLine("Daily", a.AssignmentID, a.ProjectID,
                        projectNames.GetValueOrDefault(a.ProjectID, "—"), a.WageAmount, present, absent, present * a.WageAmount, payments, grp.Key));
                }

                // Contract — a fixed sum, shown in the month the assignment starts.
                foreach (var a in grp.Where(a => a.WageType == "Contract" && a.StartDate.Year == year && a.StartDate.Month == month))
                {
                    if (!allProjects && a.ProjectID != projectId) continue;
                    lines.Add(BuildLine("Contract", a.AssignmentID, a.ProjectID,
                        projectNames.GetValueOrDefault(a.ProjectID, "—"), a.WageAmount, 0, 0, a.WageAmount, payments, grp.Key));
                }

                if (lines.Count == 0) continue;

                int paidCount = lines.Count(l => l.IsPaid);
                cards.Add(new EmployeeSalaryDto
                {
                    EmployeeID = emp.EmployeeID,
                    EmployeeName = emp.FullName,
                    Designation = emp.Designation,
                    Status = paidCount == 0 ? "Pending" : paidCount == lines.Count ? "Paid" : "Partial",
                    Total = lines.Sum(l => l.IsPaid ? l.PaidAmount : l.CalculatedAmount),
                    Lines = lines
                });
            }

            cards = cards.OrderBy(c => c.EmployeeName).ToList();

            return new SalaryPeriodDto
            {
                Year = year,
                Month = month,
                Employees = cards,
                WorkersCount = cards.Count,
                TotalPayroll = cards.Sum(c => c.Total),
                Paid = cards.Sum(c => c.Lines.Where(l => l.IsPaid).Sum(l => l.PaidAmount)),
                Pending = cards.Sum(c => c.Lines.Where(l => !l.IsPaid).Sum(l => l.CalculatedAmount))
            };
        }

        public async Task<SalaryPeriodDto> PayAsync(PaySalaryDto dto, int userId)
        {
            // Recompute the calculated amount on the server — never trust the client's number.
            decimal calculated = await ComputeCalculatedAsync(dto);

            // One payment per line — ignore a duplicate pay for an already-paid line.
            var existing = (await _salaryRepository.GetForPeriodAsync(dto.Year, dto.Month))
                .FirstOrDefault(p => p.EmployeeID == dto.EmployeeID && p.SourceType == dto.SourceType && p.AssignmentID == dto.AssignmentID);

            if (existing == null)
            {
                int? projectId = null;
                if (dto.AssignmentID != null)
                {
                    var assign = await _assignmentRepository.GetByIdAsync(dto.AssignmentID.Value);
                    projectId = assign?.ProjectID;
                }

                await _salaryRepository.AddAsync(new SalaryPayment
                {
                    EmployeeID = dto.EmployeeID,
                    Year = dto.Year,
                    Month = dto.Month,
                    SourceType = dto.SourceType,
                    AssignmentID = dto.AssignmentID,
                    ProjectID = projectId,
                    CalculatedAmount = calculated,
                    PaidAmount = dto.PaidAmount,
                    Note = dto.Note?.Trim(),
                    PaidByUserID = userId,
                    PaidAt = DateTime.Now,
                    CreatedAt = DateTime.Now
                });
            }

            return await GetPeriodAsync(dto.Year, dto.Month, null);
        }

        public async Task<SalaryPeriodDto?> RevertAsync(int paymentId)
        {
            var payment = await _salaryRepository.GetByIdAsync(paymentId);
            if (payment == null) return null;

            int year = payment.Year, month = payment.Month;
            await _salaryRepository.DeleteAsync(paymentId);
            return await GetPeriodAsync(year, month, null);
        }

        public async Task<PayslipDto?> GetPayslipAsync(int employeeId, int year, int month)
        {
            var employee = await _employeeRepository.GetByIdAsync(employeeId);
            if (employee == null) return null;

            var period = await GetPeriodAsync(year, month, null);
            var card = period.Employees.FirstOrDefault(e => e.EmployeeID == employeeId);
            var lines = card?.Lines ?? new List<SalaryLineDto>();

            return new PayslipDto
            {
                Year = year,
                Month = month,
                PeriodLabel = $"{MonthNames[month]} {year}",
                EmployeeID = employeeId,
                EmployeeName = employee.FullName,
                Designation = employee.Designation,
                CNIC = employee.CNIC,
                Phone = employee.Phone,
                Status = card?.Status ?? "Pending",
                Lines = lines,
                TotalCalculated = lines.Sum(l => l.CalculatedAmount),
                NetPaid = lines.Sum(l => l.IsPaid ? l.PaidAmount : l.CalculatedAmount),
                GeneratedAt = DateTime.Now
            };
        }

        // Server-side calculation for one line, so an override can never fake the base figure.
        private async Task<decimal> ComputeCalculatedAsync(PaySalaryDto dto)
        {
            var monthStart = new DateTime(dto.Year, dto.Month, 1);
            var monthEnd = monthStart.AddMonths(1).AddDays(-1);

            if (dto.SourceType == "Monthly")
            {
                var assignments = await _assignmentRepository.GetAllAsync();
                var monthly = assignments
                    .Where(a => a.EmployeeID == dto.EmployeeID && a.WageType == "Monthly" && Overlaps(a, monthStart, monthEnd))
                    .OrderByDescending(a => a.StartDate).FirstOrDefault();
                return monthly?.WageAmount ?? 0m;
            }

            if (dto.AssignmentID == null) return 0m;
            var assign = await _assignmentRepository.GetByIdAsync(dto.AssignmentID.Value);
            if (assign == null) return 0m;

            if (dto.SourceType == "Contract") return assign.WageAmount;

            // Daily
            var recs = await _attendanceRepository.GetByAssignmentIdsAsync(new List<int> { dto.AssignmentID.Value });
            int present = recs.Count(r => r.Status == "Present" && r.Date.Date >= monthStart && r.Date.Date <= monthEnd);
            return present * assign.WageAmount;
        }

        private static SalaryLineDto BuildLine(string type, int? assignmentId, int? projectId, string projectName,
            decimal rate, int present, int absent, decimal calculated, List<SalaryPayment> payments, int employeeId)
        {
            var pay = payments.FirstOrDefault(p =>
                p.EmployeeID == employeeId && p.SourceType == type && p.AssignmentID == assignmentId);

            return new SalaryLineDto
            {
                SourceType = type,
                AssignmentID = assignmentId,
                ProjectID = projectId,
                ProjectName = projectName,
                Rate = rate,
                PresentDays = present,
                AbsentDays = absent,
                CalculatedAmount = calculated,
                IsPaid = pay != null,
                PaidAmount = pay?.PaidAmount ?? 0m,
                Note = pay?.Note,
                PaymentID = pay?.PaymentID
            };
        }

        private static bool Overlaps(Assignment a, DateTime monthStart, DateTime monthEnd)
        {
            var start = a.StartDate.Date;
            var end = a.EndDate?.Date;
            return start <= monthEnd && (end == null || end >= monthStart);
        }
    }
}
