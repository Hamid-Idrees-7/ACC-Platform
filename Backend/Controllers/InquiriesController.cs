using System.Security.Claims;
using Backend.Auth;
using Backend.Demo;
using Backend.Models.DTOs;
using Backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Backend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class InquiriesController : ControllerBase
    {
        private readonly IInquiryService _service;
        private readonly INotificationService _notifications;

        public InquiriesController(IInquiryService service, INotificationService notifications)
        {
            _service = service;
            _notifications = notifications;
        }

        private string GetUserName() =>
            User.FindFirst("FullName")?.Value ?? User.FindFirst(ClaimTypes.Name)?.Value ?? "";

        // POST: /api/inquiries  = the website contact form (public, no sign-in needed).
        // Always saved to the real database, even if the visitor is also in the demo.
        [HttpPost]
        [AllowAnonymous]
        [UseMainDatabase]
        public async Task<IActionResult> Submit([FromBody] CreateInquiryDto dto)
        {
            var (success, message) = await _service.SubmitInquiryAsync(dto);
            if (!success)
                return BadRequest(new { message });

            if (string.IsNullOrWhiteSpace(dto.Website))
            {
                var about = string.IsNullOrWhiteSpace(dto.Service) ? "" : $" about {dto.Service.Trim()}";
                await _notifications.NotifyPermissionHoldersAsync(
                    "Messages", "View", NotificationCategories.Message, "New website message",
                    $"{dto.Name.Trim()} sent a message from the website{about}.",
                    link: NotificationLinks.Messages);
            }

            return Ok(new { message });
        }

        // GET: /api/inquiries  = all inquiries (needs Messages View)
        [HttpGet]
        [Authorize]
        [RequirePermission("Messages", "View")]
        public async Task<IActionResult> GetAll()
        {
            var inquiries = await _service.GetAllInquiriesAsync();
            return Ok(inquiries);
        }

        // GET: /api/inquiries/unread-count  = unread count for the badge (needs Messages View)
        [HttpGet("unread-count")]
        [Authorize]
        [RequirePermission("Messages", "View")]
        public async Task<IActionResult> GetUnreadCount()
        {
            var count = await _service.GetUnreadCountAsync();
            return Ok(new { count });
        }

        // PUT: /api/inquiries/5/read  = mark one as read (reading, so Messages View is enough)
        [HttpPut("{id}/read")]
        [Authorize]
        [RequirePermission("Messages", "View")]
        public async Task<IActionResult> MarkAsRead(int id)
        {
            var result = await _service.MarkAsReadAsync(id);
            if (result == null) return NotFound();
            return Ok(result);
        }

        // DELETE: /api/inquiries/5  = delete one (needs Messages Delete)
        [HttpDelete("{id}")]
        [Authorize]
        [RequirePermission("Messages", "Delete")]
        public async Task<IActionResult> Delete(int id)
        {
            var sender = await _service.GetSenderNameAsync(id);
            var deleted = await _service.DeleteInquiryAsync(id);
            if (!deleted) return NotFound();

            await _notifications.NotifyAdminsActivityAsync(
                NotificationCategories.Message, "Website message deleted",
                $"{GetUserName()} deleted the website message from {sender ?? "a visitor"}.",
                link: NotificationLinks.Messages);

            return Ok(new { message = "Inquiry deleted." });
        }

        // DELETE: /api/inquiries  = delete all (needs Messages Delete)
        [HttpDelete]
        [Authorize]
        [RequirePermission("Messages", "Delete")]
        public async Task<IActionResult> DeleteAll()
        {
            var count = (await _service.GetAllInquiriesAsync()).Count;
            await _service.DeleteAllInquiriesAsync();

            if (count > 0)
                await _notifications.NotifyAdminsActivityAsync(
                    NotificationCategories.Message, "Website messages deleted",
                    $"{GetUserName()} deleted all website messages ({count}).",
                    link: NotificationLinks.Messages);

            return Ok(new { message = "All inquiries deleted." });
        }
    }
}
