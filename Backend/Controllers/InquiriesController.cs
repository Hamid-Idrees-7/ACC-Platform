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

        // PUBLIC - the website contact form posts here (no login needed).
        // Always saved to the real database, even if the visitor is also exploring the demo.
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

        // Read all inquiries (needs Messages View access)
        [HttpGet]
        [Authorize]
        [RequirePermission("Messages", "View")]
        public async Task<IActionResult> GetAll()
        {
            var inquiries = await _service.GetAllInquiriesAsync();
            return Ok(inquiries);
        }

        // Unread count for the badge (needs Messages View access)
        [HttpGet("unread-count")]
        [Authorize]
        [RequirePermission("Messages", "View")]
        public async Task<IActionResult> GetUnreadCount()
        {
            var count = await _service.GetUnreadCountAsync();
            return Ok(new { count });
        }

        // Mark one as read (needs Messages View access - reading action)
        [HttpPut("{id}/read")]
        [Authorize]
        [RequirePermission("Messages", "View")]
        public async Task<IActionResult> MarkAsRead(int id)
        {
            var result = await _service.MarkAsReadAsync(id);
            if (result == null) return NotFound();
            return Ok(result);
        }

        // Delete one (needs Messages Delete access)
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

        // Delete all (needs Messages Delete access)
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
