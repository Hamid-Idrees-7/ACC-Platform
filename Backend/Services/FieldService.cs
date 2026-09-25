using Backend.Models.DTOs;
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

        // The project IDs this user is allowed to touch = the projects their linked
        // employee is assigned to. The single source of truth for scoping.
        private async Task<List<int>> GetMyProjectIdsAsync(int userId)
        {
            var user = await _userRepository.GetByIdAsync(userId);
            if (user?.EmployeeID == null) return new List<int>();

            var assignments = await _assignmentRepository.GetAllAsync();
            return assignments
                .Where(a => a.EmployeeID == user.EmployeeID.Value)
                .Select(a => a.ProjectID)
                .Distinct()
                .ToList();
        }

        public async Task<FieldSiteDto> GetMySiteAsync(int userId)
        {
            var user = await _userRepository.GetByIdAsync(userId);
            if (user?.EmployeeID == null)
                return new FieldSiteDto { IsFieldUser = false };

            var employee = await _employeeRepository.GetByIdAsync(user.EmployeeID.Value);
            var myProjectIds = await GetMyProjectIdsAsync(userId);

            var allProjects = await _projectService.GetAllProjectsAsync();
            var mine = allProjects.Where(p => myProjectIds.Contains(p.ProjectID)).ToList();

            var today = DateTime.Now;
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
            if (!myProjectIds.Contains(projectId)) return null;   // not your site — refused

            return await _attendanceService.GetSheetAsync(projectId, date);
        }

        public async Task<AttendanceSheetDto?> MarkAttendanceAsync(int userId, int projectId, MarkAttendanceDto dto)
        {
            var myProjectIds = await GetMyProjectIdsAsync(userId);
            if (!myProjectIds.Contains(projectId)) return null;   // not your site — refused

            return await _attendanceService.SaveAsync(projectId, dto);
        }

        public async Task<List<ProjectPhaseDto>?> GetPhasesAsync(int userId, int projectId)
        {
            var myProjectIds = await GetMyProjectIdsAsync(userId);
            if (!myProjectIds.Contains(projectId)) return null;

            var detail = await _projectService.GetProjectDetailAsync(projectId);
            return detail?.Phases ?? new List<ProjectPhaseDto>();
        }

        public async Task<List<ProjectPhaseDto>?> UpdateProgressAsync(int userId, int projectId, FieldProgressDto dto)
        {
            var myProjectIds = await GetMyProjectIdsAsync(userId);
            if (!myProjectIds.Contains(projectId)) return null;

            var detail = await _projectService.GetProjectDetailAsync(projectId);
            if (detail == null) return null;

            // The phase must belong to THIS project — an engineer can't touch another site's phase.
            var phase = detail.Phases.FirstOrDefault(p => p.PhaseID == dto.PhaseID);
            if (phase == null) return null;

            int progress = Math.Clamp(dto.Progress, 0, 100);
            string status = progress <= 0 ? "Pending" : progress >= 100 ? "Completed" : "In Progress";

            await _projectService.UpdatePhaseAsync(dto.PhaseID, new UpdatePhaseDto { Status = status, Progress = progress });

            var updated = await _projectService.GetProjectDetailAsync(projectId);
            return updated?.Phases ?? new List<ProjectPhaseDto>();
        }

        public async Task<FieldRequestOptionsDto?> GetRequestOptionsAsync(int userId, int projectId)
        {
            var myProjectIds = await GetMyProjectIdsAsync(userId);
            if (!myProjectIds.Contains(projectId)) return null;

            var materials = await _materialService.GetAllMaterialsAsync();
            var detail = await _projectService.GetProjectDetailAsync(projectId);
            return new FieldRequestOptionsDto
            {
                Materials = materials.Where(m => m.Status == "Active").ToList(),
                Phases = detail?.Phases ?? new List<ProjectPhaseDto>()
            };
        }

        public async Task<(MaterialRequestDto? Request, string? Error)> CreateRequestAsync(int userId, int projectId, CreateMaterialRequestDto dto)
        {
            var myProjectIds = await GetMyProjectIdsAsync(userId);
            if (!myProjectIds.Contains(projectId))
                return (null, "This site is not assigned to you.");

            // Quantity must be a positive number.
            if (dto.Quantity <= 0)
                return (null, "Enter a quantity greater than zero.");

            // The material must exist and be Active — a crafted request can't smuggle in a
            // deleted / inactive / non-existent material.
            var materials = await _materialService.GetAllMaterialsAsync();
            var material = materials.FirstOrDefault(m => m.MaterialID == dto.MaterialID);
            if (material == null)
                return (null, "Select a valid material.");
            if (!string.Equals(material.Status, "Active", StringComparison.OrdinalIgnoreCase))
                return (null, "That material isn't available for requests.");

            // If a phase was chosen, it must belong to THIS project (not another site's phase).
            if (dto.PhaseID.HasValue)
            {
                var detail = await _projectService.GetProjectDetailAsync(projectId);
                var phaseBelongs = detail?.Phases.Any(p => p.PhaseID == dto.PhaseID.Value) ?? false;
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

            // NOTE: financials (budget/cost/profit) are deliberately never returned to the field.
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
