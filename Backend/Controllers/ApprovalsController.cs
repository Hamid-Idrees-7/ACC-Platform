using System.Security.Claims;
using Backend.Auth;
using Backend.Models.DTOs;
using Backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Backend.Controllers
{
    // Manages approval requests (pending actions). Base route: /api/approvals
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class ApprovalsController : ControllerBase
    {
        private readonly IPendingActionService _service;

        public ApprovalsController(IPendingActionService service)
        {
            _service = service;
        }

        private int GetUserId()
        {
            var idClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return int.TryParse(idClaim, out var id) ? id : 0;
        }

        private string GetUserName() =>
            User.FindFirst("FullName")?.Value ?? User.FindFirst(ClaimTypes.Name)?.Value ?? "";

        private string GetUserRole() =>
            User.FindFirst(ClaimTypes.Role)?.Value ?? "";

        // GET: /api/approvals  - all requests (Admin only)
        [HttpGet]
        [AdminOnly]
        public async Task<IActionResult> GetAll()
        {
            var list = await _service.GetAllAsync();
            return Ok(list);
        }

        // GET: /api/approvals/count  - pending count (Admin only, for the dashboard card)
        [HttpGet("count")]
        [AdminOnly]
        public async Task<IActionResult> GetCount()
        {
            var count = await _service.GetPendingCountAsync();
            return Ok(new { count });
        }

        // POST: /api/approvals  - create a request (any authenticated user)
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreatePendingActionDto dto)
        {
            await _service.CreateAsync(dto, GetUserId(), GetUserName(), GetUserRole());
            return Ok(new { message = "Request sent to administration for approval." });
        }

        // PUT: /api/approvals/5/resolve  - approve or reject (Admin only)
        [HttpPut("{id}/resolve")]
        [AdminOnly]
        public async Task<IActionResult> Resolve(int id, [FromBody] ResolvePendingActionDto dto)
        {
            var (success, error) = await _service.ResolveAsync(id, dto);
            if (!success)
                return BadRequest(new { message = error });

            return Ok(new { message = $"Request {dto.Status.ToLower()}." });
        }

        // DELETE: /api/approvals/5  - delete one request (Admin only)
        [HttpDelete("{id}")]
        [AdminOnly]
        public async Task<IActionResult> Delete(int id)
        {
            var deleted = await _service.DeleteAsync(id);
            if (!deleted)
                return NotFound(new { message = "Request not found." });

            return Ok(new { message = "Request deleted." });
        }

        // DELETE: /api/approvals  - delete all requests (Admin only)
        [HttpDelete]
        [AdminOnly]
        public async Task<IActionResult> DeleteAll()
        {
            await _service.DeleteAllAsync();
            return Ok(new { message = "All requests deleted." });
        }
    }
}