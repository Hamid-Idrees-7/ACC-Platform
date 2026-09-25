using System.Security.Claims;
using Backend.Auth;
using Backend.Models.DTOs;
using Backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Backend.Controllers
{
    // Field View — a site engineer scoped workspace. Base route: /api/field
    // The service scopes everything to the caller's own assigned projects, so even a
    // crafted request for another project is refused (404)
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class FieldController : ControllerBase
    {
        private readonly IFieldService _service;

        public FieldController(IFieldService service)
        {
            _service = service;
        }

        private int GetUserId()
        {
            var idClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return int.TryParse(idClaim, out var id) ? id : 0;
        }

        // GET /api/field/my-site — the engineer's own projects + todays attendance
        [HttpGet("my-site")]
        [RequirePermission("Field", "View")]
        public async Task<IActionResult> MySite()
        {
            return Ok(await _service.GetMySiteAsync(GetUserId()));
        }

        // GET /api/field/sheet/5?date=2026-09-25 — attendance sheet for my project
        [HttpGet("sheet/{projectId}")]
        [RequirePermission("Field", "View")]
        public async Task<IActionResult> Sheet(int projectId, [FromQuery] DateTime? date)
        {
            var sheet = await _service.GetSheetAsync(GetUserId(), projectId, date ?? DateTime.Now);
            if (sheet == null)
                return NotFound(new { message = "This site is not assigned to you." });
            return Ok(sheet);
        }

        // POST /api/field/attendance/5 — mark attendance for my project
        [HttpPost("attendance/{projectId}")]
        [RequirePermission("Field", "Manage")]
        public async Task<IActionResult> MarkAttendance(int projectId, [FromBody] MarkAttendanceDto dto)
        {
            var sheet = await _service.MarkAttendanceAsync(GetUserId(), projectId, dto);
            if (sheet == null)
                return NotFound(new { message = "This site is not assigned to you." });
            return Ok(sheet);
        }

        // GET /api/field/phases/5 — the phases of my own project
        [HttpGet("phases/{projectId}")]
        [RequirePermission("Field", "View")]
        public async Task<IActionResult> Phases(int projectId)
        {
            var phases = await _service.GetPhasesAsync(GetUserId(), projectId);
            if (phases == null)
                return NotFound(new { message = "This site is not assigned to you." });
            return Ok(phases);
        }

        // POST /api/field/progress/5 — update a phase's progress on my own project
        [HttpPost("progress/{projectId}")]
        [RequirePermission("Field", "Manage")]
        public async Task<IActionResult> UpdateProgress(int projectId, [FromBody] FieldProgressDto dto)
        {
            var phases = await _service.UpdateProgressAsync(GetUserId(), projectId, dto);
            if (phases == null)
                return NotFound(new { message = "This site or phase is not assigned to you." });
            return Ok(phases);
        }

        // GET /api/field/request-options/5 — materials + phases to build a request
        [HttpGet("request-options/{projectId}")]
        [RequirePermission("Field", "View")]
        public async Task<IActionResult> RequestOptions(int projectId)
        {
            var options = await _service.GetRequestOptionsAsync(GetUserId(), projectId);
            if (options == null)
                return NotFound(new { message = "This site is not assigned to you." });
            return Ok(options);
        }

        // POST /api/field/material-request/5 — raise a material request for my site
        [HttpPost("material-request/{projectId}")]
        [RequirePermission("Field", "Manage")]
        public async Task<IActionResult> CreateRequest(int projectId, [FromBody] CreateMaterialRequestDto dto)
        {
            var (created, error) = await _service.CreateRequestAsync(GetUserId(), projectId, dto);
            if (created == null)
                return BadRequest(new { message = error ?? "Could not create the request." });
            return Ok(created);
        }

        // GET /api/field/my-requests — my own material requests + their status
        [HttpGet("my-requests")]
        [RequirePermission("Field", "View")]
        public async Task<IActionResult> MyRequests()
        {
            return Ok(await _service.GetMyRequestsAsync(GetUserId()));
        }

        // GET /api/field/site-info/5 — non-financial details of my site
        [HttpGet("site-info/{projectId}")]
        [RequirePermission("Field", "View")]
        public async Task<IActionResult> SiteInfo(int projectId)
        {
            var info = await _service.GetSiteInfoAsync(GetUserId(), projectId);
            if (info == null)
                return NotFound(new { message = "This site is not assigned to you." });
            return Ok(info);
        }

        // DELETE /api/field/material-request/5 — cancel my own pending request
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
