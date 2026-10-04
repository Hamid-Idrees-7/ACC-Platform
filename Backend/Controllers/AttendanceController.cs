using Backend.Auth;
using Backend.Models.DTOs;
using Backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Backend.Controllers
{
    // Attendance sheets per project. Base route: /api/attendance
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class AttendanceController : ControllerBase
    {
        private readonly IAttendanceService _service;
        private readonly IPermissionService _permissionService;

        public AttendanceController(IAttendanceService service, IPermissionService permissionService)
        {
            _service = service;
            _permissionService = permissionService;
        }

        // Wages only for people who may see them (see MoneyAccess).
        private async Task<AttendanceSheetDto> ForViewerAsync(AttendanceSheetDto sheet)
        {
            if (await MoneyAccess.CanSeeAsync(User, _permissionService, MoneyAccess.Wages)) return sheet;
            sheet.ShowWages = false;
            foreach (var w in sheet.MonthlyStaff.Concat(sheet.DailyWorkers)) w.WageAmount = 0;
            return sheet;
        }

        // GET: /api/attendance  = project cards for the list page
        [HttpGet]
        [RequirePermission("Attendance", "View")]
        public async Task<IActionResult> GetCards()
        {
            var cards = await _service.GetProjectCardsAsync();
            return Ok(cards);
        }

        // GET: /api/attendance/5?date=2026-08-26  = one project's sheet for a date
        [HttpGet("{projectId}")]
        [RequirePermission("Attendance", "View")]
        public async Task<IActionResult> GetSheet(int projectId, [FromQuery] DateTime? date)
        {
            var sheet = await _service.GetSheetAsync(projectId, date ?? AppTime.Now);
            if (sheet == null)
                return NotFound(new { message = "Project not found" });

            return Ok(await ForViewerAsync(sheet));
        }

        // POST: /api/attendance/5  = save the marked rows for a date
        [HttpPost("{projectId}")]
        [RequirePermission("Attendance", "Mark")]
        public async Task<IActionResult> Save(int projectId, [FromBody] MarkAttendanceDto dto)
        {
            var (sheet, error) = await _service.SaveAsync(projectId, dto);
            if (error != null)
                return BadRequest(new { message = error });
            if (sheet == null)
                return NotFound(new { message = "Project not found" });

            return Ok(await ForViewerAsync(sheet));
        }
    }
}
