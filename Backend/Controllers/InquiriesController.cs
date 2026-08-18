using Backend.Auth;
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

        public InquiriesController(IInquiryService service)
        {
            _service = service;
        }

        // PUBLIC - the website contact form posts here (no login needed)
        [HttpPost]
        [AllowAnonymous]
        public async Task<IActionResult> Submit([FromBody] CreateInquiryDto dto)
        {
            var (success, message) = await _service.SubmitInquiryAsync(dto);
            if (!success)
                return BadRequest(new { message });

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
            var deleted = await _service.DeleteInquiryAsync(id);
            if (!deleted) return NotFound();
            return Ok(new { message = "Inquiry deleted." });
        }

        // Delete all (needs Messages Delete access)
        [HttpDelete]
        [Authorize]
        [RequirePermission("Messages", "Delete")]
        public async Task<IActionResult> DeleteAll()
        {
            await _service.DeleteAllInquiriesAsync();
            return Ok(new { message = "All inquiries deleted." });
        }
    }
}
