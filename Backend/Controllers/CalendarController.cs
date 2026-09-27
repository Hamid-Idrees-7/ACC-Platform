using System.Security.Claims;
using Backend.Auth;
using Backend.Models.DTOs;
using Backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Backend.Controllers
{
    // Settings > Calendar. Everyone signed in can read it (attendance needs the off days);
    // only the Admin can change it.
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class CalendarController : ControllerBase
    {
        private readonly ICalendarService _service;

        public CalendarController(ICalendarService service)
        {
            _service = service;
        }

        private string GetUserName() =>
            User.FindFirst("FullName")?.Value ?? User.FindFirst(ClaimTypes.Name)?.Value ?? "";

        // GET: /api/calendar
        [HttpGet]
        public async Task<IActionResult> Get()
        {
            return Ok(await _service.GetAsync());
        }

        // PUT: /api/calendar/weekly-off  - Admin only
        [HttpPut("weekly-off")]
        [AdminOnly]
        public async Task<IActionResult> SaveWeeklyOff([FromBody] SaveWeeklyOffDto dto)
        {
            var (calendar, error, field) = await _service.SaveWeeklyOffAsync(dto);
            if (error != null) return BadRequest(new { message = error, field });
            return Ok(calendar);
        }

        // POST: /api/calendar/holidays  - Admin only
        [HttpPost("holidays")]
        [AdminOnly]
        public async Task<IActionResult> AddHoliday([FromBody] SaveHolidayDto dto)
        {
            var (calendar, error, field) = await _service.AddHolidayAsync(dto, GetUserName());
            if (error != null) return BadRequest(new { message = error, field });
            return Ok(calendar);
        }

        // PUT: /api/calendar/holidays/5  - Admin only
        [HttpPut("holidays/{id}")]
        [AdminOnly]
        public async Task<IActionResult> UpdateHoliday(int id, [FromBody] SaveHolidayDto dto)
        {
            var (calendar, error, field) = await _service.UpdateHolidayAsync(id, dto);
            if (error != null) return BadRequest(new { message = error, field });
            return Ok(calendar);
        }

        // DELETE: /api/calendar/holidays/5  - Admin only
        [HttpDelete("holidays/{id}")]
        [AdminOnly]
        public async Task<IActionResult> DeleteHoliday(int id)
        {
            var calendar = await _service.DeleteHolidayAsync(id);
            if (calendar == null) return NotFound(new { message = "This holiday no longer exists." });
            return Ok(calendar);
        }
    }
}
