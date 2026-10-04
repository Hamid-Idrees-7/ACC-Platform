using Backend.Models.DTOs;
using Backend.Models.Entities;
using Backend.Repositories;

namespace Backend.Services
{
    public class FieldService : IFieldService
    {
        private readonly IUserRepository _userRepository;
        private readonly IEmployeeRepository _employeeRepository;
        private readonly IAssignmentRepository _assignmentRepository;
        private readonly IProjectService _projectService;
        private readonly IAttendanceService _attendanceService;
        private readonly IMaterialService _materialService;
        private readonly IMaterialRequestService _materialRequestService;

        public FieldService(
            IUserRepository userRepository,
            IEmployeeRepository employeeRepository,
            IAssignmentRepository assignmentRepository,
            IProjectService projectService,
            IAttendanceService attendanceService,
            IMaterialService materialService,
            IMaterialRequestService materialRequestService)
        {
            _userRepository = userRepository;
            _employeeRepository = employeeRepository;
            _assignmentRepository = assignmentRepository;
            _projectService = projectService;
            _attendanceService = attendanceService;
            _materialService = materialService;
            _materialRequestService = materialRequestService;
        }

        // The projects this user may work on: the ones their linked employee is assigned to today.
        // An ended assignment gives no access to the old site. All scoping in this service goes through here.
        private async Task<List<int>> GetMyProjectIdsAsync(int userId)
        {
            var user = await _userRepository.GetByIdAsync(userId);
            if (user?.EmployeeID == null) return new List<int>();

            var today = AppTime.Now.Date;
            var assignments = await _assignmentRepository.GetByEmployeeAsync(user.EmployeeID.Value);
            return assignments
                .Where(a => IsCurrent(a, today))
                .Select(a => a.ProjectID)
                .Distinct()
                .ToList();
        }

        // An active assignment whose period includes the given day.
        public static bool IsCurrent(Assignment a, DateTime day) =>
            a.Status == "Active" && a.StartDate.Date <= day && (a.EndDate == null || a.EndDate.Value.Date >= day);

        public async Task<FieldSiteDto> GetMySiteAsync(int userId)
        {
            var user = await _userRepository.GetByIdAsync(userId);
            if (user?.EmployeeID == null)
                return new FieldSiteDto { IsFieldUser = false };

            var employee = await _employeeRepository.GetByIdAsync(user.EmployeeID.Value);
            var myProjectIds = await GetMyProjectIdsAsync(userId);

            var allProjects = await _projectService.GetAllProjectsAsync();
            var mine = allProjects.Where(p => myProjectIds.Contains(p.ProjectID)).ToList();

            var today = AppTime.Now;
            var cards = new List<FieldProjectCardDto>();

            foreach (var p in mine)
            {
                var sheet = await _attendanceService.GetSheetAsync(p.ProjectID, today);
                int workers = (sheet?.MonthlyStaff.Count ?? 0) + (sheet?.DailyWorkers.Count ?? 0);

                cards.Add(new FieldProjectCardDto
                {
                    ProjectID = p.ProjectID,
                    Title = p.Title,
                    Location = p.Location,
                    Status = p.Status,
                    Progress = p.OverallProgress,
                    WorkersCount = workers,
                    TodayPresent = sheet?.PresentCount ?? 0,
                    TodayAbsent = sheet?.AbsentCount ?? 0,
                    TodayUnmarked = sheet?.UnmarkedCount ?? 0
                });
            }

            // Active projects first, then by title.
            cards = cards
                .OrderByDescending(c => c.Status == "In Progress")
                .ThenBy(c => c.Title)
                .ToList();

            return new FieldSiteDto
            {
                EmployeeName = employee?.FullName ?? user.FullName,
                Designation = employee?.Designation ?? "",
                IsFieldUser = true,
                Projects = cards
            };
        }

        public async Task<AttendanceSheetDto?> GetSheetAsync(int userId, int projectId, DateTime date)
        {
            var myProjectIds = await GetMyProjectIdsAsync(userId);
            if (!myProjectIds.Contains(projectId)) return null;   // not their site

            return WithoutWages(await _attendanceService.GetSheetAsync(projectId, date));
        }

        // Field users see who is on site, never what anyone is paid.
        private static AttendanceSheetDto? WithoutWages(AttendanceSheetDto? sheet)
        {
            if (sheet == null) return null;
            sheet.ShowWages = false;
            foreach (var w in sheet.MonthlyStaff.Concat(sheet.DailyWorkers)) w.WageAmount = 0;
            return sheet;
        }

        // How far back a site engineer may mark: today and the two days before. Older days
        // are corrected in the office (Attendance), so paid history can't be rewritten from site.
        private const int FieldDaysBack = 2;

        public async Task<(AttendanceSheetDto? Sheet, string? Error)> MarkAttendanceAsync(int userId, int projectId, MarkAttendanceDto dto)
        {
            var myProjectIds = await GetMyProjectIdsAsync(userId);
            if (!myProjectIds.Contains(projectId)) return (null, null);   // not their site

            var today = AppTime.Today;
            var day = dto.Date.Date;
            if (day < today.AddDays(-FieldDaysBack))
                return (null, "From site you can mark today and the last two days only. Ask the office to correct older days.");

            // Not before the engineer's own posting on this site started
            var user = await _userRepository.GetByIdAsync(userId);
            var mine = (await _assignmentRepository.GetByProjectAsync(projectId))
                .Where(a => a.EmployeeID == user?.EmployeeID && IsCurrent(a, today))
                .ToList();
            if (mine.Count > 0 && day < mine.Min(a => a.StartDate.Date))
                return (null, "That day is before your posting on this site started.");

            var (sheet, error) = await _attendanceService.SaveAsync(projectId, dto);
            return (WithoutWages(sheet), error);
        }

        public async Task<List<ProjectPhaseDto>?> GetPhasesAsync(int userId, int projectId)
        {
            var myProjectIds = await GetMyProjectIdsAsync(userId);
            if (!myProjectIds.Contains(projectId)) return null;

            return await _projectService.GetPhaseListAsync(projectId);
        }

        public async Task<List<ProjectPhaseDto>?> UpdateProgressAsync(int userId, int projectId, FieldProgressDto dto)
        {
            var myProjectIds = await GetMyProjectIdsAsync(userId);
            if (!myProjectIds.Contains(projectId)) return null;

            // The phase must belong to this project, so an engineer can't touch another site's phase.
            var phase = (await _projectService.GetPhaseListAsync(projectId)).FirstOrDefault(p => p.PhaseID == dto.PhaseID);
            if (phase == null) return null;

            int progress = Math.Clamp(dto.Progress, 0, 100);
            string status = progress <= 0 ? "Pending" : progress >= 100 ? "Completed" : "In Progress";

            await _projectService.UpdatePhaseAsync(dto.PhaseID, new UpdatePhaseDto { Status = status, Progress = progress });

            return await _projectService.GetPhaseListAsync(projectId);
        }

        public async Task<FieldRequestOptionsDto?> GetRequestOptionsAsync(int userId, int projectId)
        {
            var myProjectIds = await GetMyProjectIdsAsync(userId);
            if (!myProjectIds.Contains(projectId)) return null;

            var materials = await _materialService.GetAllMaterialsAsync();
            var phases = await _projectService.GetPhaseListAsync(projectId);
            return new FieldRequestOptionsDto
            {
                // Name, unit and stock only: purchase costs stay in the office.
                Materials = materials.Where(m => m.Status == "Active")
                    .Select(m => { m.AvgCost = 0; m.StockValue = 0; return m; })
                    .ToList(),
                Phases = phases
            };
        }

        public async Task<(MaterialRequestDto? Request, string? Error)> CreateRequestAsync(int userId, int projectId, CreateMaterialRequestDto dto)
        {
            var myProjectIds = await GetMyProjectIdsAsync(userId);
            if (!myProjectIds.Contains(projectId))
                return (null, "This site is not assigned to you.");

            if (dto.Quantity <= 0)
                return (null, "Enter a quantity greater than zero.");
            if (dto.Quantity > 1_000_000_000m)
                return (null, "The quantity is too large.");

            // The material must exist and be Active, so a crafted request can't slip in a
            // deleted, inactive or made-up material.
            var materials = await _materialService.GetAllMaterialsAsync();
            var material = materials.FirstOrDefault(m => m.MaterialID == dto.MaterialID);
            if (material == null)
                return (null, "Select a valid material.");
            if (!string.Equals(material.Status, "Active", StringComparison.OrdinalIgnoreCase))
                return (null, "That material isn't available for requests.");

            // A chosen phase must belong to this project, not to another site.
            if (dto.PhaseID.HasValue)
            {
                var phaseBelongs = (await _projectService.GetPhaseListAsync(projectId)).Any(p => p.PhaseID == dto.PhaseID.Value);
                if (!phaseBelongs)
                    return (null, "That phase doesn't belong to this site.");
            }

            var created = await _materialRequestService.CreateAsync(userId, projectId, dto);
            return (created, null);
        }

        public async Task<List<MaterialRequestDto>> GetMyRequestsAsync(int userId)
        {
            return await _materialRequestService.GetForUserAsync(userId);
        }

        public async Task<FieldSiteInfoDto?> GetSiteInfoAsync(int userId, int projectId)
        {
            var myProjectIds = await GetMyProjectIdsAsync(userId);
            if (!myProjectIds.Contains(projectId)) return null;

            var detail = await _projectService.GetProjectDetailAsync(projectId);
            if (detail == null) return null;

            // Money figures (budget, cost, profit) are never sent to the field, on purpose.
            return new FieldSiteInfoDto
            {
                ProjectID = detail.ProjectID,
                Title = detail.Title,
                ClientName = detail.ClientName,
                Location = detail.Location,
                ProjectType = detail.ProjectType,
                AreaSize = detail.AreaSize,
                Status = detail.Status,
                OverallProgress = detail.OverallProgress,
                StartDate = detail.StartDate,
                ExpectedEndDate = detail.ExpectedEndDate,
                Description = detail.Description,
                TotalPhases = detail.Phases.Count,
                CompletedPhases = detail.Phases.Count(p => p.Progress >= 100),
                TeamSize = detail.Team.Count
            };
        }

        public async Task<(bool Success, string? Error)> DeleteRequestAsync(int userId, int requestId)
        {
            // The engineer can only cancel their own request, and only while it's still Pending.
            return await _materialRequestService.DeleteOwnPendingAsync(userId, requestId);
        }
    }
}
