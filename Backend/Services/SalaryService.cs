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
        private readonly ICompanySettingsService _companyService;

        private static readonly string[] SourceTypes = { "Daily", "Monthly", "Contract" };
        private const decimal MaxPayment = 10_000_000_000m;

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
            ISalaryRepository salaryRepository,
            ICompanySettingsService companyService)
        {
            _employeeRepository = employeeRepository;
            _assignmentRepository = assignmentRepository;
            _projectRepository = projectRepository;
            _attendanceRepository = attendanceRepository;
            _salaryRepository = salaryRepository;
            _companyService = companyService;
        }

        public async Task<SalaryPeriodDto> GetPeriodAsync(int year, int month, int? projectId)
        {
            var monthStart = new DateTime(year, month, 1);
            var monthEnd = monthStart.AddMonths(1).AddDays(-1);
            var earnedTo = EarnedTo(monthEnd);
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

                // Monthly: one line per employee (company payroll, not tied to a project).
                var monthlyList = grp.Where(a => a.WageType == "Monthly").ToList();
                if (monthlyList.Count > 0 && allProjects)
                {
                    var (rate, amount, covered) = MonthlyPay(monthlyList, monthStart, earnedTo);
                    var line = BuildLine("Monthly", null, null, "", rate, 0, 0, amount, payments, grp.Key);
                    line.CoveredDays = covered;
                    line.MonthDays = DateTime.DaysInMonth(monthStart.Year, monthStart.Month);
                    lines.Add(line);
                }

                // Daily: per assignment, present days in the month (inside the assignment's own dates) x rate.
                foreach (var a in grp.Where(a => a.WageType == "Daily"))
                {
                    if (!allProjects && a.ProjectID != projectId) continue;
                    attByAssignment.TryGetValue(a.AssignmentID, out var allRecs);
                    var recs = allRecs?.Where(r => InPeriod(a, r.Date)).ToList();
                    int present = recs?.Count(r => r.Status == "Present") ?? 0;
                    int absent = recs?.Count(r => r.Status == "Absent") ?? 0;
                    lines.Add(BuildLine("Daily", a.AssignmentID, a.ProjectID,
                        projectNames.GetValueOrDefault(a.ProjectID, "—"), a.WageAmount, present, absent, present * a.WageAmount, payments, grp.Key));
                }

                // Contract: a fixed sum, shown in the month the assignment starts.
                foreach (var a in grp.Where(a => a.WageType == "Contract" && a.StartDate.Year == year && a.StartDate.Month == month))
                {
                    if (!allProjects && a.ProjectID != projectId) continue;
                    lines.Add(BuildLine("Contract", a.AssignmentID, a.ProjectID,
                        projectNames.GetValueOrDefault(a.ProjectID, "—"), a.WageAmount, 0, 0, a.WageAmount, payments, grp.Key));
                }

                if (lines.Count == 0) continue;

                bool anyPaid = lines.Any(l => l.PaidAmount > 0);
                bool nothingDue = lines.All(l => l.DueAmount == 0);
                cards.Add(new EmployeeSalaryDto
                {
                    EmployeeID = emp.EmployeeID,
                    EmployeeName = emp.FullName,
                    Designation = emp.Designation,
                    Status = !anyPaid ? "Pending" : nothingDue ? "Paid" : "Partial",
                    Total = lines.Sum(l => l.PaidAmount + l.DueAmount),
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
                Paid = cards.Sum(c => c.Lines.Sum(l => l.PaidAmount)),
                Pending = cards.Sum(c => c.Lines.Sum(l => l.DueAmount))
            };
        }

        public async Task<(SalaryPeriodDto?, string?)> PayAsync(PaySalaryDto dto, int userId)
        {
            if (dto.Month < 1 || dto.Month > 12 || dto.Year < 2000 || dto.Year > 2100)
                return (null, "Choose a valid month.");

            var type = SourceTypes.FirstOrDefault(t => t == dto.SourceType);
            if (type == null) return (null, "Unknown salary line.");

            var monthStart = new DateTime(dto.Year, dto.Month, 1);
            var monthEnd = monthStart.AddMonths(1).AddDays(-1);

            if (dto.PaidAmount <= 0) return (null, "Enter an amount greater than zero.");
            if (dto.PaidAmount > MaxPayment) return (null, "The amount is too large.");
            var paid = Math.Round(dto.PaidAmount, 2);

            var note = string.IsNullOrWhiteSpace(dto.Note) ? null : dto.Note.Trim();
            if (note?.Length > 255) return (null, "The note can be at most 255 characters.");

            // The line must really exist for this employee and month.
            int? projectId = null;
            if (type == "Monthly")
            {
                if (dto.AssignmentID != null) return (null, "Unknown salary line.");
                var hasMonthly = (await _assignmentRepository.GetAllAsync())
                    .Any(a => a.EmployeeID == dto.EmployeeID && a.WageType == "Monthly" && Overlaps(a, monthStart, monthEnd));
                if (!hasMonthly) return (null, "This employee has no monthly salary for that month.");
            }
            else
            {
                var assign = dto.AssignmentID == null ? null : await _assignmentRepository.GetByIdAsync(dto.AssignmentID.Value);
                if (assign == null || assign.EmployeeID != dto.EmployeeID || assign.WageType != type)
                    return (null, "Unknown salary line.");
                if (type == "Contract" && (assign.StartDate.Year != dto.Year || assign.StartDate.Month != dto.Month))
                    return (null, "A contract is paid in the month it starts.");
                if (type == "Daily" && !Overlaps(assign, monthStart, monthEnd))
                    return (null, "This assignment has no days in that month.");
                projectId = assign.ProjectID;
            }

            // One payment per employee at a time, so two quick clicks can't both pay what is due.
            using var gate = await Locks.ForSalaryAsync(_salaryRepository.DatabaseName, dto.EmployeeID);

            // Work the amounts out again on the server; never trust the client's numbers.
            decimal calculated = await ComputeCalculatedAsync(dto);
            decimal alreadyPaid = (await _salaryRepository.GetForPeriodAsync(dto.Year, dto.Month))
                .Where(p => SameLine(p, dto.EmployeeID, type, dto.AssignmentID))
                .Sum(p => p.PaidAmount);
            decimal due = calculated - alreadyPaid;

            if (due <= 0)
                return (null, alreadyPaid > 0 ? "This line is fully paid. Nothing more is due yet." : "Nothing has been earned on this line yet.");
            if (paid > due)
                return (null, $"Only {await _companyService.FormatMoneyAsync(due)} is due on this line. Enter that or less.");

            await _salaryRepository.AddAsync(new SalaryPayment
            {
                EmployeeID = dto.EmployeeID,
                Year = dto.Year,
                Month = dto.Month,
                SourceType = type,
                AssignmentID = dto.AssignmentID,
                ProjectID = projectId,
                CalculatedAmount = calculated,
                PaidAmount = paid,
                Note = note,
                PaidByUserID = userId,
                PaidAt = DateTime.Now,
                CreatedAt = DateTime.Now
            });

            return (await GetPeriodAsync(dto.Year, dto.Month, null), null);
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
                Company = await _companyService.GetBrandAsync(),
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
                TotalPaid = lines.Sum(l => l.PaidAmount),
                TotalDue = lines.Sum(l => l.DueAmount),
                GeneratedAt = DateTime.Now
            };
        }

        public async Task<SalaryPaymentSummary?> DescribePaymentAsync(int paymentId)
        {
            var payment = await _salaryRepository.GetByIdAsync(paymentId);
            if (payment == null) return null;
            return new SalaryPaymentSummary(await EmployeeNameAsync(payment.EmployeeID), payment.Year, payment.Month, payment.PaidAmount);
        }

        public async Task<string> EmployeeNameAsync(int employeeId)
        {
            var employee = await _employeeRepository.GetByIdAsync(employeeId);
            return employee?.FullName ?? "an employee";
        }

        public static string PeriodLabel(int year, int month) =>
            month is >= 1 and <= 12 ? $"{MonthNames[month]} {year}" : $"{year}";

        // Server-side calculation for one line, so an override can never fake the base figure.
        private async Task<decimal> ComputeCalculatedAsync(PaySalaryDto dto)
        {
            var monthStart = new DateTime(dto.Year, dto.Month, 1);
            var monthEnd = monthStart.AddMonths(1).AddDays(-1);

            if (dto.SourceType == "Monthly")
            {
                var monthly = (await _assignmentRepository.GetAllAsync())
                    .Where(a => a.EmployeeID == dto.EmployeeID && a.WageType == "Monthly" && Overlaps(a, monthStart, monthEnd))
                    .ToList();
                return monthly.Count == 0 ? 0m : MonthlyPay(monthly, monthStart, EarnedTo(monthEnd)).Amount;
            }

            if (dto.AssignmentID == null) return 0m;
            var assign = await _assignmentRepository.GetByIdAsync(dto.AssignmentID.Value);
            if (assign == null) return 0m;

            if (dto.SourceType == "Contract") return assign.WageAmount;

            // Daily
            var recs = await _attendanceRepository.GetByAssignmentIdsAsync(new List<int> { dto.AssignmentID.Value });
            int present = recs.Count(r => r.Status == "Present" && r.Date.Date >= monthStart && r.Date.Date <= monthEnd && InPeriod(assign, r.Date));
            return present * assign.WageAmount;
        }

        // A monthly salary for the days it covers from the 1st up to lastDay: each day earns
        // 1/days-in-month of the wage of the monthly assignment running that day (the latest one
        // if several overlap, so the same person is never paid twice for one day).
        // A full month is the full wage.
        private static (decimal Rate, decimal Amount, int Covered) MonthlyPay(List<Assignment> monthly, DateTime monthStart, DateTime lastDay)
        {
            var latestFirst = monthly.OrderByDescending(a => a.StartDate).ThenByDescending(a => a.AssignmentID).ToList();
            int days = DateTime.DaysInMonth(monthStart.Year, monthStart.Month);
            decimal total = 0m;
            int covered = 0;
            for (var d = monthStart; d <= lastDay; d = d.AddDays(1))
            {
                var running = latestFirst.FirstOrDefault(a => InPeriod(a, d));
                if (running == null) continue;
                total += running.WageAmount;
                covered++;
            }
            return (latestFirst[0].WageAmount, Math.Round(total / days, 2), covered);
        }

        // Pay is earned up to today: the whole month once it is over, nothing for a future month.
        private static DateTime EarnedTo(DateTime monthEnd) =>
            monthEnd < DateTime.Now.Date ? monthEnd : DateTime.Now.Date;

        private static bool SameLine(SalaryPayment p, int employeeId, string type, int? assignmentId) =>
            p.EmployeeID == employeeId && p.SourceType == type && p.AssignmentID == assignmentId;

        private static bool InPeriod(Assignment a, DateTime day) =>
            day.Date >= a.StartDate.Date && (a.EndDate == null || day.Date <= a.EndDate.Value.Date);

        private static SalaryLineDto BuildLine(string type, int? assignmentId, int? projectId, string projectName,
            decimal rate, int present, int absent, decimal calculated, List<SalaryPayment> payments, int employeeId)
        {
            var paid = payments.Where(p => SameLine(p, employeeId, type, assignmentId))
                .OrderBy(p => p.PaidAt).ThenBy(p => p.PaymentID).ToList();
            var last = paid.LastOrDefault();
            decimal paidTotal = paid.Sum(p => p.PaidAmount);
            decimal due = Math.Max(0m, calculated - paidTotal);

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
                PaidAmount = paidTotal,
                DueAmount = due,
                PaymentsCount = paid.Count,
                IsPaid = paid.Count > 0 && due == 0,
                Note = last?.Note,
                PaymentID = last?.PaymentID,
                LastPaidAmount = last?.PaidAmount ?? 0m
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
