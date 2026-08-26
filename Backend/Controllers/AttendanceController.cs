using Backend.Auth;
using Backend.Models.DTOs;
using Backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Backend.Controllers
{
    // API endpoints for attendance. Base route: /api/attendance
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class AttendanceController : ControllerBase
    {
        private readonly IAttendanceService _service;

        public AttendanceController(IAttendanceService service)
        {
            _service = service;
        }

        // GET: /api/attendance — project cards for the list page
        [HttpGet]
        [RequirePermission("Attendance", "View")]
        public async Task<IActionResult> GetCards()
        {
            var cards = await _service.GetProjectCardsAsync();
            return Ok(cards);
        }

        // GET: /api/attendance/5?date=2026-08-26 — the sheet for a project on a date
        [HttpGet("{projectId}")]
        [RequirePermission("Attendance", "View")]
        public async Task<IActionResult> GetSheet(int projectId, [FromQuery] DateTime? date)
        {
            var sheet = await _service.GetSheetAsync(projectId, date ?? DateTime.Now);
            if (sheet == null)
                return NotFound(new { message = "Project not found" });

            return Ok(sheet);
        }

        // POST: /api/attendance/5 — save the marked rows for a date
        [HttpPost("{projectId}")]
        [RequirePermission("Attendance", "Mark")]
        public async Task<IActionResult> Save(int projectId, [FromBody] MarkAttendanceDto dto)
        {
            var sheet = await _service.SaveAsync(projectId, dto);
            if (sheet == null)
                return NotFound(new { message = "Project not found" });

            return Ok(sheet);
        }
    }
}
