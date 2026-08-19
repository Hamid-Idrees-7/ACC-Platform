using System.Security.Claims;
using Backend.Auth;
using Backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Backend.Controllers
{
    // Each user's notifications. Base route: /api/notifications
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class NotificationsController : ControllerBase
    {
        private readonly INotificationService _service;

        public NotificationsController(INotificationService service)
        {
            _service = service;
        }

        private int GetUserId()
        {
            var idClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return int.TryParse(idClaim, out var id) ? id : 0;
        }

        private bool IsAdmin()
        {
            var role = User.FindFirst(ClaimTypes.Role)?.Value;
            return string.Equals(role, "Admin", StringComparison.OrdinalIgnoreCase);
        }

        // GET: /api/notifications          = my personal notifications
        // GET: /api/notifications?type=Activity  = users' activity (admins only)
        [HttpGet]
        public async Task<IActionResult> GetMine([FromQuery] string type = "Personal")
        {
            // Only admins can read the Activity feed
            if (type == "Activity" && !IsAdmin())
                return StatusCode(403, new { message = "Not allowed." });

            var list = await _service.GetForUserAsync(GetUserId(), type);
            return Ok(list);
        }

        // GET: /api/notifications/unread-count = unread personal count (bell badge)
        [HttpGet("unread-count")]
        public async Task<IActionResult> GetUnreadCount()
        {
            var count = await _service.GetUnreadCountAsync(GetUserId());
            return Ok(new { count });
        }

        // PUT: /api/notifications/5/read = mark one as read
        [HttpPut("{id}/read")]
        public async Task<IActionResult> MarkRead(int id)
        {
            var ok = await _service.MarkAsReadAsync(id, GetUserId());
            if (!ok) return NotFound();
            return Ok(new { message = "Marked as read" });
        }

        // PUT: /api/notifications/read-all?type=Personal  = mark all of a type as read
        [HttpPut("read-all")]
        public async Task<IActionResult> MarkAllRead([FromQuery] string type = "Personal")
        {
            if (type == "Activity" && !IsAdmin())
                return StatusCode(403, new { message = "Not allowed." });

            await _service.MarkAllReadAsync(GetUserId(), type);
            return Ok(new { message = "All marked as read" });
        }

        // DELETE: /api/notifications/5  = delete one
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var ok = await _service.DeleteAsync(id, GetUserId());
            if (!ok) return NotFound();
            return Ok(new { message = "Notification deleted" });
        }

        // DELETE: /api/notifications?type=Personal  = delete all of a type
        [HttpDelete]
        public async Task<IActionResult> DeleteAll([FromQuery] string type = "Personal")
        {
            if (type == "Activity" && !IsAdmin())
                return StatusCode(403, new { message = "Not allowed." });

            await _service.DeleteAllAsync(GetUserId(), type);
            return Ok(new { message = "All notifications deleted" });
        }
    }
}