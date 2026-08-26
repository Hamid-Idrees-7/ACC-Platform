using Backend.Models.DTOs;
using Backend.Models.Entities;
using Backend.Repositories;

namespace Backend.Services
{
    public class AttendanceService : IAttendanceService
    {
        private readonly IProjectRepository _projectRepository;
        private readonly IAssignmentRepository _assignmentRepository;
        private readonly IEmployeeRepository _employeeRepository;
        private readonly IAttendanceRepository _attendanceRepository;

        // Roles that lead a site — used to pick the Site Incharge
        private static readonly string[] LeadKeywords =
            { "engineer", "supervisor", "manager", "incharge", "architect", "foreman" };

        public AttendanceService(
            IProjectRepository projectRepository,
            IAssignmentRepository assignmentRepository,
            IEmployeeRepository employeeRepository,
            IAttendanceRepository attendanceRepository)
        {
            _projectRepository = projectRepository;
            _assignmentRepository = assignmentRepository;
            _employeeRepository = employeeRepository;
            _attendanceRepository = attendanceRepository;
        }

        private static bool IsLead(string role) =>
            LeadKeywords.Any(k => (role ?? "").ToLower().Contains(k));

        public async Task<List<AttendanceProjectCardDto>> GetProjectCardsAsync()
        {
            var projects = await _projectRepository.GetAllAsync();
            var assignments = await _assignmentRepository.GetAllAsync();
            var employees = await _employeeRepository.GetAllAsync();
            var employeeNames = employees.ToDictionary(e => e.EmployeeID, e => e.FullName);

            var byProject = assignments
                .GroupBy(a => a.ProjectID)
                .ToDictionary(g => g.Key, g => g.ToList());

            return projects.Select(p =>
            {
                byProject.TryGetValue(p.ProjectID, out var list);
                list ??= new List<Assignment>();

                // Same person on two assignments counts once
                var workersCount = list.Select(a => a.EmployeeID).Distinct().Count();
                var incharge = ResolveIncharge(list, employeeNames);

                return new AttendanceProjectCardDto
                {
                    ProjectID = p.ProjectID,
                    Title = p.Title,
                    Location = p.Location,
                    Status = p.Status,
                    SiteIncharge = incharge,
                    WorkersCount = workersCount
                };
            }).ToList();
        }

        public async Task<AttendanceSheetDto?> GetSheetAsync(int projectId, DateTime date)
        {
            var project = await _projectRepository.GetByIdAsync(projectId);
            if (project == null) return null;

            var day = date.Date;
            var today = DateTime.Now.Date;

            // Contract workers are a fixed lump sum — no attendance is tracked for them
            var assignments = (await _assignmentRepository.GetByProjectAsync(projectId))
                .Where(a => a.WageType != "Contract")
                .ToList();

            var employees = await _employeeRepository.GetAllAsync();
            var employeeNames = employees.ToDictionary(e => e.EmployeeID, e => e.FullName);

            var assignmentIds = assignments.Select(a => a.AssignmentID).ToList();
            var records = await _attendanceRepository.GetByAssignmentIdsAsync(assignmentIds);
            var byAssignment = records
                .GroupBy(r => r.AssignmentID)
                .ToDictionary(g => g.Key, g => g.ToList());

            var monthly = new List<AttendanceWorkerDto>();
            var daily = new List<AttendanceWorkerDto>();

            foreach (var a in assignments)
            {
                byAssignment.TryGetValue(a.AssignmentID, out var recs);
                recs ??= new List<Attendance>();

                var name = employeeNames.GetValueOrDefault(a.EmployeeID, "—");
                var worker = BuildWorker(a, recs, name, day, today);

                if (a.WageType == "Monthly") monthly.Add(worker);
                else daily.Add(worker);
            }

            var onSite = monthly.Concat(daily).Where(w => w.OnSiteThisDate).ToList();

            return new AttendanceSheetDto
            {
                ProjectID = project.ProjectID,
                ProjectTitle = project.Title,
                Location = project.Location,
                Status = project.Status,
                SiteIncharge = ResolveIncharge(assignments, employeeNames),
                Date = day,
                IsReadOnly = project.Status == "Cancelled",
                MonthlyStaff = monthly,
                DailyWorkers = daily,
                PresentCount = onSite.Count(w => w.Status == "Present"),
                AbsentCount = onSite.Count(w => w.Status == "Absent"),
                UnmarkedCount = onSite.Count(w => w.Status == null)
            };
        }

        public async Task<AttendanceSheetDto?> SaveAsync(int projectId, MarkAttendanceDto dto)
        {
            var project = await _projectRepository.GetByIdAsync(projectId);
            if (project == null) return null;

            var day = dto.Date.Date;

            // Cancelled projects are read-only, and the future can't be marked.
            if (project.Status == "Cancelled" || day > DateTime.Now.Date)
                return await GetSheetAsync(projectId, dto.Date);

            var assignments = (await _assignmentRepository.GetByProjectAsync(projectId))
                .Where(a => a.WageType != "Contract")
                .ToDictionary(a => a.AssignmentID, a => a);

            foreach (var entry in dto.Entries)
            {
                if (!assignments.TryGetValue(entry.AssignmentID, out var a)) continue;

                // Only mark days that fall inside the assignment's period.
                var startDay = a.StartDate.Date;
                var endDay = a.EndDate?.Date;
                bool onSite = day >= startDay && (endDay == null || day <= endDay);
                if (!onSite) continue;

                var status = entry.Status == "Absent" ? "Absent" : "Present";

                var existing = await _attendanceRepository.GetByAssignmentAndDateAsync(entry.AssignmentID, day);
                if (existing == null)
                {
                    await _attendanceRepository.AddAsync(new Attendance
                    {
                        AssignmentID = entry.AssignmentID,
                        Date = day,
                        Status = status,
                        Note = entry.Note,
                        CreatedAt = DateTime.Now,
                        UpdatedAt = DateTime.Now
                    });
                }
                else
                {
                    existing.Status = status;
                    existing.Note = entry.Note;
                    existing.UpdatedAt = DateTime.Now;
                    await _attendanceRepository.UpdateAsync(existing);
                }
            }

            return await GetSheetAsync(projectId, dto.Date);
        }

        // The site incharge is the project's lead assignment (engineer/supervisor/etc.),
        // preferring an active one, otherwise the most recent.
        private static string ResolveIncharge(List<Assignment> list, Dictionary<int, string> employeeNames)
        {
            var lead = list
                .Where(a => IsLead(a.Role))
                .OrderByDescending(a => a.Status == "Active")
                .ThenByDescending(a => a.StartDate)
                .FirstOrDefault();

            return lead != null
                ? employeeNames.GetValueOrDefault(lead.EmployeeID, "Not assigned")
                : "Not assigned";
        }

        // Build one worker row: on-site flag for the selected date, that date's status,
        // and a day-by-day timeline from start up to the earlier of end date and today.
        private static AttendanceWorkerDto BuildWorker(Assignment a, List<Attendance> recs, string name, DateTime day, DateTime today)
        {
            var startDay = a.StartDate.Date;
            var endDay = a.EndDate?.Date;
            bool onSite = day >= startDay && (endDay == null || day <= endDay);

            var recByDate = recs.ToDictionary(r => r.Date.Date, r => r);
            recByDate.TryGetValue(day, out var todayRec);

            var timelineEnd = endDay.HasValue && endDay.Value < today ? endDay.Value : today;
            var timeline = new List<AttendanceDayDto>();
            for (var d = startDay; d <= timelineEnd; d = d.AddDays(1))
            {
                recByDate.TryGetValue(d, out var r);
                timeline.Add(new AttendanceDayDto { Date = d, Status = r?.Status });
            }

            return new AttendanceWorkerDto
            {
                AssignmentID = a.AssignmentID,
                EmployeeID = a.EmployeeID,
                EmployeeName = name,
                Role = a.Role,
                WageType = a.WageType,
                WageAmount = a.WageAmount,
                StartDate = a.StartDate,
                EndDate = a.EndDate,
                OnSiteThisDate = onSite,
                Status = todayRec?.Status,
                Note = todayRec?.Note,
                Timeline = timeline
            };
        }
    }
}
