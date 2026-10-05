using System.Text.RegularExpressions;
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
        private readonly ISalaryRepository _salaryRepository;

        // Roles that lead a site, used to pick the site incharge
        private static readonly string[] LeadKeywords =
            { "engineer", "supervisor", "manager", "incharge", "architect", "foreman" };

        public AttendanceService(
            IProjectRepository projectRepository,
            IAssignmentRepository assignmentRepository,
            IEmployeeRepository employeeRepository,
            IAttendanceRepository attendanceRepository,
            ISalaryRepository salaryRepository)
        {
            _projectRepository = projectRepository;
            _assignmentRepository = assignmentRepository;
            _employeeRepository = employeeRepository;
            _attendanceRepository = attendanceRepository;
            _salaryRepository = salaryRepository;
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
            var today = AppTime.Now.Date;

            // Contract workers get a fixed lump sum, so no attendance is tracked for them
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

            monthly = SortSheet(monthly);
            daily = SortSheet(daily);
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

        public async Task<(AttendanceSheetDto? Sheet, string? Error)> SaveAsync(int projectId, MarkAttendanceDto dto)
        {
            var project = await _projectRepository.GetByIdAsync(projectId);
            if (project == null) return (null, null);

            var day = dto.Date.Date;

            // Cancelled projects are read-only, and the future can't be marked.
            if (project.Status == "Cancelled")
                return (null, "This project is cancelled, so attendance can't be marked.");
            if (day > AppTime.Today)
                return (null, "Attendance can only be marked up to today.");

            var assignments = (await _assignmentRepository.GetByProjectAsync(projectId))
                .Where(a => a.WageType != "Contract")
                .ToDictionary(a => a.AssignmentID, a => a);
            var names = (await _employeeRepository.GetAllAsync()).ToDictionary(e => e.EmployeeID, e => e.FullName);
            string NameOf(Assignment a) => names.GetValueOrDefault(a.EmployeeID, "A worker");

            // Every entry is checked first; nothing is saved unless all of them are valid.
            var entries = new List<(Assignment A, string Status, string? Note)>();
            foreach (var entry in dto.Entries.GroupBy(e => e.AssignmentID).Select(g => g.Last()))
            {
                if (!assignments.TryGetValue(entry.AssignmentID, out var a))
                    return (null, "Some workers are no longer on this site. Reload the page and try again.");

                // Only days inside the assignment's period can be marked.
                bool onSite = day >= a.StartDate.Date && (a.EndDate == null || day <= a.EndDate.Value.Date);
                if (!onSite)
                    return (null, $"{NameOf(a)} isn't on this site on {day:dd MMM yyyy}, so nothing was saved.");

                // A worker can be Present on more than one site in a day; each site pays its own day.
                var status = entry.Status == "Absent" ? "Absent" : "Present";
                var note = string.IsNullOrWhiteSpace(entry.Note) ? null : entry.Note.Trim();
                if (note?.Length > 255) note = note[..255];
                entries.Add((a, status, note));
            }

            // Daily pay depends on Present days, so the save waits for any payment being made for
            // the same people, and a paid Present day can't quietly turn Absent.
            var dailyPeople = entries.Where(e => e.A.WageType == "Daily").Select(e => e.A.EmployeeID).Distinct().OrderBy(id => id);
            var gates = new List<IDisposable>();
            try
            {
                foreach (var employeeId in dailyPeople)
                    gates.Add(await Locks.ForSalaryAsync(_salaryRepository.DatabaseName, employeeId));

                var existing = (await _attendanceRepository.GetForDayAsync(entries.Select(e => e.A.AssignmentID).ToList(), day))
                    .ToDictionary(r => r.AssignmentID);

                var paidError = await PaidDaysErrorAsync(entries, existing, day, NameOf);
                if (paidError != null) return (null, paidError);

                // The whole sheet in one save
                var added = new List<Attendance>();
                foreach (var (a, status, note) in entries)
                {
                    if (existing.TryGetValue(a.AssignmentID, out var row))
                    {
                        if (row.Status == status && row.Note == note) continue;
                        row.Status = status;
                        row.Note = note;
                        row.UpdatedAt = AppTime.Now;
                    }
                    else
                    {
                        added.Add(new Attendance
                        {
                            AssignmentID = a.AssignmentID,
                            Date = day,
                            Status = status,
                            Note = note,
                            CreatedAt = AppTime.Now,
                            UpdatedAt = AppTime.Now
                        });
                    }
                }

                // Someone saved the same day at the same moment: go row by row instead.
                if (!await _attendanceRepository.TrySaveDayAsync(added))
                    foreach (var (a, status, note) in entries)
                        await SaveOneAsync(a.AssignmentID, day, status, note);
            }
            finally
            {
                foreach (var gate in gates) gate.Dispose();
            }

            return (await GetSheetAsync(projectId, dto.Date), null);
        }

        // A Present day turning Absent in a month whose pay was already made for it.
        private async Task<string?> PaidDaysErrorAsync(List<(Assignment A, string Status, string? Note)> entries,
            Dictionary<int, Attendance> existing, DateTime day, Func<Assignment, string> nameOf)
        {
            var turningAbsent = entries
                .Where(e => e.A.WageType == "Daily" && e.Status == "Absent" &&
                            existing.TryGetValue(e.A.AssignmentID, out var row) && row.Status == "Present")
                .Select(e => e.A)
                .ToList();
            if (turningAbsent.Count == 0) return null;

            var monthStart = new DateTime(day.Year, day.Month, 1);
            var monthEnd = monthStart.AddMonths(1).AddDays(-1);
            var payments = await _salaryRepository.GetForPeriodAsync(day.Year, day.Month);
            var records = await _attendanceRepository.GetByAssignmentIdsAsync(turningAbsent.Select(a => a.AssignmentID).ToList());

            foreach (var a in turningAbsent)
            {
                var paid = payments.Where(p => p.SourceType == "Daily" && p.AssignmentID == a.AssignmentID).Sum(p => p.PaidAmount);
                if (paid <= 0) continue;
                int presentAfter = records.Count(r => r.AssignmentID == a.AssignmentID && r.Status == "Present" &&
                    r.Date.Date >= monthStart && r.Date.Date <= monthEnd && r.Date.Date != day &&
                    r.Date.Date >= a.StartDate.Date && (a.EndDate == null || r.Date.Date <= a.EndDate.Value.Date));
                if (presentAfter * a.WageAmount < paid)
                    return $"{nameOf(a)}'s pay for {monthStart:MMMM yyyy} already covers this day. Undo that payment in Salaries before marking the day Absent.";
            }
            return null;
        }

        private async Task SaveOneAsync(int assignmentId, DateTime day, string status, string? note)
        {
            var existing = await _attendanceRepository.GetByAssignmentAndDateAsync(assignmentId, day);
            if (existing == null)
            {
                var added = await _attendanceRepository.TryAddAsync(new Attendance
                {
                    AssignmentID = assignmentId,
                    Date = day,
                    Status = status,
                    Note = note,
                    CreatedAt = AppTime.Now,
                    UpdatedAt = AppTime.Now
                });
                if (added) return;

                // Saved by someone else at the same moment: update that row instead.
                existing = await _attendanceRepository.GetByAssignmentAndDateAsync(assignmentId, day);
                if (existing == null) return;
            }

            existing.Status = status;
            existing.Note = note;
            existing.UpdatedAt = AppTime.Now;
            await _attendanceRepository.UpdateAsync(existing);
        }

        // On-site workers first, then by name with the number read as a number
        // (Labourer 2 before Labourer 10), then the earlier stint first.
        private static List<AttendanceWorkerDto> SortSheet(List<AttendanceWorkerDto> list) =>
            list.OrderByDescending(w => w.OnSiteThisDate)
                .ThenBy(w => NameKey(w.EmployeeName).Text, StringComparer.OrdinalIgnoreCase)
                .ThenBy(w => NameKey(w.EmployeeName).Number)
                .ThenBy(w => w.StartDate)
                .ToList();

        private static (string Text, long Number) NameKey(string? name)
        {
            var m = Regex.Match(name ?? "", @"^(.*?)\s*(\d{1,15})$");
            return m.Success ? (m.Groups[1].Value, long.Parse(m.Groups[2].Value)) : (name ?? "", 0);
        }

        // The site incharge is the project's lead assignment (engineer, supervisor and so on),
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

        // One worker row: the on-site flag for the selected date, that date's status,
        // and a day-by-day timeline from start up to the earlier of end date and today.
        private static AttendanceWorkerDto BuildWorker(Assignment a, List<Attendance> recs, string name, DateTime day, DateTime today)
        {
            var startDay = a.StartDate.Date;
            var endDay = a.EndDate?.Date;
            bool onSite = day >= startDay && (endDay == null || day <= endDay);

            // GroupBy, so an old duplicate row can never break the sheet.
            var recByDate = recs.GroupBy(r => r.Date.Date).ToDictionary(g => g.Key, g => g.OrderByDescending(r => r.UpdatedAt).First());
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
