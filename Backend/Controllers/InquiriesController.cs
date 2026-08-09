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

        // ADMIN ONLY - dashboard reads all inquiries
        [HttpGet]
        [Authorize]
        public async Task<IActionResult> GetAll()
        {
            var inquiries = await _service.GetAllInquiriesAsync();
            return Ok(inquiries);
        }

        // ADMIN ONLY - unread count for the badge
        [HttpGet("unread-count")]
        [Authorize]
        public async Task<IActionResult> GetUnreadCount()
        {
            var count = await _service.GetUnreadCountAsync();
            return Ok(new { count });
        }

        // ADMIN ONLY - mark one as read
        [HttpPut("{id}/read")]
        [Authorize]
        public async Task<IActionResult> MarkAsRead(int id)
        {
            var result = await _service.MarkAsReadAsync(id);
            if (result == null) return NotFound();
            return Ok(result);
        }

        // ADMIN ONLY - delete one
        [HttpDelete("{id}")]
        [Authorize]
        public async Task<IActionResult> Delete(int id)
        {
            var deleted = await _service.DeleteInquiryAsync(id);
            if (!deleted) return NotFound();
            return Ok(new { message = "Inquiry deleted." });
        }

        // ADMIN ONLY - delete all
        [HttpDelete]
        [Authorize]
        public async Task<IActionResult> DeleteAll()
        {
            await _service.DeleteAllInquiriesAsync();
            return Ok(new { message = "All inquiries deleted." });
        }
    }
}