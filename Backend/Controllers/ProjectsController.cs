using System.Security.Claims;
using Backend.Auth;
using Backend.Models.DTOs;
using Backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Backend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class ProjectsController : ControllerBase
    {
        private readonly IProjectService _service;
        private readonly IPermissionService _permissionService;
        private readonly IPendingActionService _approvalService;
        private readonly INotificationService _notificationService;

        public ProjectsController(
            IProjectService service,
            IPermissionService permissionService,
            IPendingActionService approvalService,
            INotificationService notificationService)
        {
            _service = service;
            _permissionService = permissionService;
            _approvalService = approvalService;
            _notificationService = notificationService;
        }

        private int GetUserId()
        {
            var idClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return int.TryParse(idClaim, out var id) ? id : 0;
        }

        private string GetUserName() =>
            User.FindFirst("FullName")?.Value ?? User.FindFirst(ClaimTypes.Name)?.Value ?? "";

        private string GetUserRole() =>
            User.FindFirst(ClaimTypes.Role)?.Value ?? "";

        private bool IsAdmin() =>
            string.Equals(GetUserRole(), "Admin", StringComparison.OrdinalIgnoreCase);

        // GET: /api/projects
        [HttpGet]
        [RequirePermission("Projects", "View")]
        public async Task<IActionResult> GetAll()
        {
            var projects = await _service.GetAllProjectsAsync();
            return Ok(projects);
        }

        // GET: /api/projects/5
        [HttpGet("{id}")]
        [RequirePermission("Projects", "View")]
        public async Task<IActionResult> GetById(int id)
        {
            var project = await _service.GetProjectDetailAsync(id);
            if (project == null)
                return NotFound(new { message = "Project not found" });

            return Ok(project);
        }

        // POST: /api/projects
        [HttpPost]
        [RequirePermission("Projects", "Add")]
        public async Task<IActionResult> Create([FromBody] CreateProjectDto dto)
        {
            var project = await _service.CreateProjectAsync(dto);

            await _notificationService.NotifyPersonalAsync(
                GetUserId(), "Project", "Project created", $"You created project: {project.Title}.");
            await _notificationService.NotifyAdminsActivityAsync(
                "Project", "New project", $"{GetUserName()} created project: {project.Title}.");

            return CreatedAtAction(nameof(GetById), new { id = project.ProjectID }, project);
        }

        // PUT: /api/projects/5
        [HttpPut("{id}")]
        [RequirePermission("Projects", "Edit")]
        public async Task<IActionResult> Update(int id, [FromBody] CreateProjectDto dto)
        {
            var project = await _service.UpdateProjectAsync(id, dto);
            if (project == null)
                return NotFound(new { message = "Project not found" });

            return Ok(project);
        }

        // PUT: /api/projects/5/status
        [HttpPut("{id}/status")]
        [RequirePermission("Projects", "Manage")]
        public async Task<IActionResult> ChangeStatus(int id, [FromBody] UpdateProjectStatusDto dto)
        {
            var project = await _service.ChangeStatusAsync(id, dto.Status);
            if (project == null)
                return NotFound(new { message = "Project not found or invalid status." });

            await _notificationService.NotifyAdminsActivityAsync(
                "Project", "Status changed", $"{GetUserName()} set project \"{project.Title}\" to {project.Status}.");

            return Ok(project);
        }

        // POST: /api/projects/5/phases
        [HttpPost("{id}/phases")]
        [RequirePermission("Projects", "Manage")]
        public async Task<IActionResult> AddPhase(int id, [FromBody] CreatePhaseDto dto)
        {
            var phase = await _service.AddPhaseAsync(id, dto);
            if (phase == null)
                return NotFound(new { message = "Project not found" });

            return Ok(phase);
        }

        // PUT: /api/projects/phases/9
        [HttpPut("phases/{phaseId}")]
        [RequirePermission("Projects", "Manage")]
        public async Task<IActionResult> UpdatePhase(int phaseId, [FromBody] UpdatePhaseDto dto)
        {
            var phase = await _service.UpdatePhaseAsync(phaseId, dto);
            if (phase == null)
                return NotFound(new { message = "Phase not found" });

            return Ok(phase);
        }

        // DELETE: /api/projects/phases/9
        [HttpDelete("phases/{phaseId}")]
        [RequirePermission("Projects", "Manage")]
        public async Task<IActionResult> DeletePhase(int phaseId)
        {
            var deleted = await _service.DeletePhaseAsync(phaseId);
            if (!deleted)
                return NotFound(new { message = "Phase not found" });

            return Ok(new { message = "Phase deleted" });
        }

        // PUT: /api/projects/5/phases/reorder
        [HttpPut("{id}/phases/reorder")]
        [RequirePermission("Projects", "Manage")]
        public async Task<IActionResult> ReorderPhases(int id, [FromBody] ReorderPhasesDto dto)
        {
            await _service.ReorderPhasesAsync(id, dto.PhaseIDs);
            return Ok(new { message = "Phases reordered" });
        }

        // DELETE: /api/projects/5 (or request approval if required)
        [HttpDelete("{id}")]
        [RequirePermission("Projects", "Delete")]
        public async Task<IActionResult> Delete(int id)
        {
            var project = await _service.GetProjectDetailAsync(id);
            if (project == null)
                return NotFound(new { message = "Project not found" });

            // Protect money history: a project with issued materials, expenses or invoices can't be deleted.
            var blocker = await _service.GetDeleteBlockerAsync(id);
            if (blocker != null)
                return BadRequest(new { message = blocker });

            if (!IsAdmin() && await _permissionService.RequiresApprovalAsync(GetUserId(), "Projects", "Delete"))
            {
                var created = await _approvalService.CreateAsync(
                    new CreatePendingActionDto
                    {
                        Module = "Projects",
                        Action = "Delete",
                        TargetID = id,
                        TargetName = project.Title
                    },
                    GetUserId(), GetUserName(), GetUserRole());

                if (!created)
                    return Ok(new { requiresApproval = true, alreadyPending = true, message = $"A delete request for \"{project.Title}\" is already awaiting approval." });

                return Ok(new { requiresApproval = true, message = $"Request to delete \"{project.Title}\" sent to administration for approval." });
            }

            var deleted = await _service.DeleteProjectAsync(id);
            if (!deleted)
                return NotFound(new { message = "Project not found" });

            await _notificationService.NotifyPersonalAsync(
                GetUserId(), "Project", "Project deleted", $"You deleted project: {project.Title}.");
            await _notificationService.NotifyAdminsActivityAsync(
                "Project", "Project deleted", $"{GetUserName()} deleted project: {project.Title}.");

            return Ok(new { message = "Project deleted successfully" });
        }
    }
}
