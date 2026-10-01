using System.Security.Claims;
using Backend.Auth;
using Backend.Models.DTOs;
using Backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Backend.Controllers
{
    // Field View: the site engineer's own workspace. Base route: /api/field
    // The service limits everything to the caller's assigned projects, so even a crafted
    // request for another project gets a 404.
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class FieldController : ControllerBase
    {
        private readonly IFieldService _service;
        private readonly IProjectService _projects;
        private readonly INotificationService _notifications;

        public FieldController(IFieldService service, IProjectService projects, INotificationService notifications)
        {
            _service = service;
            _projects = projects;
            _notifications = notifications;
        }

        private string GetUserName() =>
            User.FindFirst("FullName")?.Value ?? User.FindFirst(ClaimTypes.Name)?.Value ?? "";

        private int GetUserId()
        {
            var idClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return int.TryParse(idClaim, out var id) ? id : 0;
        }

        // GET: /api/field/my-site  = the engineer's projects and today's attendance
        [HttpGet("my-site")]
        [RequirePermission("Field", "View")]
        public async Task<IActionResult> MySite()
        {
            return Ok(await _service.GetMySiteAsync(GetUserId()));
        }

        // GET: /api/field/sheet/5?date=2026-09-25  = attendance sheet for my project
        [HttpGet("sheet/{projectId}")]
        [RequirePermission("Field", "View")]
        public async Task<IActionResult> Sheet(int projectId, [FromQuery] DateTime? date)
        {
            var sheet = await _service.GetSheetAsync(GetUserId(), projectId, date ?? DateTime.Now);
            if (sheet == null)
                return NotFound(new { message = "This site is not assigned to you." });
            return Ok(sheet);
        }

        // POST: /api/field/attendance/5  = mark attendance for my project
        [HttpPost("attendance/{projectId}")]
        [RequirePermission("Field", "Manage")]
        public async Task<IActionResult> MarkAttendance(int projectId, [FromBody] MarkAttendanceDto dto)
        {
            var sheet = await _service.MarkAttendanceAsync(GetUserId(), projectId, dto);
            if (sheet == null)
                return NotFound(new { message = "This site is not assigned to you." });
            return Ok(sheet);
        }

        // GET: /api/field/phases/5  = the phases of my project
        [HttpGet("phases/{projectId}")]
        [RequirePermission("Field", "View")]
        public async Task<IActionResult> Phases(int projectId)
        {
            var phases = await _service.GetPhasesAsync(GetUserId(), projectId);
            if (phases == null)
                return NotFound(new { message = "This site is not assigned to you." });
            return Ok(phases);
        }

        // POST: /api/field/progress/5  = update a phase's progress on my project
        [HttpPost("progress/{projectId}")]
        [RequirePermission("Field", "Manage")]
        public async Task<IActionResult> UpdateProgress(int projectId, [FromBody] FieldProgressDto dto)
        {
            var before = await _projects.DescribePhaseAsync(dto.PhaseID);
            var phases = await _service.UpdateProgressAsync(GetUserId(), projectId, dto);
            if (phases == null)
                return NotFound(new { message = "This site or phase is not assigned to you." });

            var after = phases.FirstOrDefault(p => p.PhaseID == dto.PhaseID);
            if (before != null && after != null && (before.Progress != after.Progress || before.Status != after.Status))
                await _notifications.NotifyAdminsActivityAsync(
                    "Project", "Site progress updated",
                    $"{GetUserName()} set {after.Name} at {before.ProjectTitle} to {after.Progress}% ({after.Status}).",
                    link: NotificationLinks.Project(before.ProjectID));

            return Ok(phases);
        }

        // GET: /api/field/request-options/5  = materials and phases for a new request
        [HttpGet("request-options/{projectId}")]
        [RequirePermission("Field", "View")]
        public async Task<IActionResult> RequestOptions(int projectId)
        {
            var options = await _service.GetRequestOptionsAsync(GetUserId(), projectId);
            if (options == null)
                return NotFound(new { message = "This site is not assigned to you." });
            return Ok(options);
        }

        // POST: /api/field/material-request/5  = raise a material request for my site
        [HttpPost("material-request/{projectId}")]
        [RequirePermission("Field", "Manage")]
        public async Task<IActionResult> CreateRequest(int projectId, [FromBody] CreateMaterialRequestDto dto)
        {
            var (created, error) = await _service.CreateRequestAsync(GetUserId(), projectId, dto);
            if (created == null)
                return BadRequest(new { message = error ?? "Could not create the request." });
            return Ok(created);
        }

        // GET: /api/field/my-requests  = my material requests and their status
        [HttpGet("my-requests")]
        [RequirePermission("Field", "View")]
        public async Task<IActionResult> MyRequests()
        {
            return Ok(await _service.GetMyRequestsAsync(GetUserId()));
        }

        // GET: /api/field/site-info/5  = details of my site, without money figures
        [HttpGet("site-info/{projectId}")]
        [RequirePermission("Field", "View")]
        public async Task<IActionResult> SiteInfo(int projectId)
        {
            var info = await _service.GetSiteInfoAsync(GetUserId(), projectId);
            if (info == null)
                return NotFound(new { message = "This site is not assigned to you." });
            return Ok(info);
        }

        // DELETE: /api/field/material-request/5  = cancel my own pending request
        [HttpDelete("material-request/{id}")]
        [RequirePermission("Field", "Manage")]
        public async Task<IActionResult> DeleteRequest(int id)
        {
            var (ok, error) = await _service.DeleteRequestAsync(GetUserId(), id);
            if (!ok)
                return BadRequest(new { message = error });
            return Ok(new { message = "Request cancelled." });
        }
    }
}
