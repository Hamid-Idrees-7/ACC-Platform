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

        // GET: /api/approvals  - all requests (needs View access)
        [HttpGet]
        [RequirePermission("Approvals", "View")]
        public async Task<IActionResult> GetAll()
        {
            var list = await _service.GetAllAsync();
            return Ok(list);
        }

        // GET: /api/approvals/count  - pending count (needs View access, for the dashboard card)
        [HttpGet("count")]
        [RequirePermission("Approvals", "View")]
        public async Task<IActionResult> GetCount()
        {
            var count = await _service.GetPendingCountAsync();
            return Ok(new { count });
        }

        // POST: /api/approvals  - create a request (any authenticated user - this is how
        // a delete request gets queued; not a Control Unit action)
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreatePendingActionDto dto)
        {
            var created = await _service.CreateAsync(dto, GetUserId(), GetUserName(), GetUserRole());
            if (!created)
                return Ok(new { alreadyPending = true, message = "A request for this item is already awaiting approval." });

            return Ok(new { message = "Request sent to administration for approval." });
        }

        // PUT: /api/approvals/5/resolve  - approve or reject (needs Manage access)
        [HttpPut("{id}/resolve")]
        [RequirePermission("Approvals", "Manage")]
        public async Task<IActionResult> Resolve(int id, [FromBody] ResolvePendingActionDto dto)
        {
            var (success, error) = await _service.ResolveAsync(id, dto);
            if (!success)
                return BadRequest(new { message = error });

            return Ok(new { message = $"Request {dto.Status.ToLower()}." });
        }

        // DELETE: /api/approvals/5  - delete one request (needs Delete access)
        [HttpDelete("{id}")]
        [RequirePermission("Approvals", "Delete")]
        public async Task<IActionResult> Delete(int id)
        {
            var deleted = await _service.DeleteAsync(id);
            if (!deleted)
                return NotFound(new { message = "Request not found." });

            return Ok(new { message = "Request deleted." });
        }

        // DELETE: /api/approvals  - delete all requests (needs Delete access)
        [HttpDelete]
        [RequirePermission("Approvals", "Delete")]
        public async Task<IActionResult> DeleteAll()
        {
            await _service.DeleteAllAsync();
            return Ok(new { message = "All requests deleted." });
        }
    }
}
