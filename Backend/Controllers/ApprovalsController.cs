using System.Security.Claims;
using Backend.Auth;
using Backend.Models.DTOs;
using Backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Backend.Controllers
{
    // Approval requests (eg a delete waiting for an admin). Base route: /api/approvals
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

        // GET: /api/approvals  = all requests (needs View)
        [HttpGet]
        [RequirePermission("Approvals", "View")]
        public async Task<IActionResult> GetAll()
        {
            var list = await _service.GetAllAsync();
            return Ok(list);
        }

        // GET: /api/approvals/count  = pending count for the dashboard card (needs View)
        [HttpGet("count")]
        [RequirePermission("Approvals", "View")]
        public async Task<IActionResult> GetCount()
        {
            var count = await _service.GetPendingCountAsync();
            return Ok(new { count });
        }

        // Requests are only created by each module's own delete endpoint, which checks the
        // permission and reads the item's name from the database. There is no public create.

        // PUT: /api/approvals/5/resolve  = approve or reject (needs Manage)
        [HttpPut("{id}/resolve")]
        [RequirePermission("Approvals", "Manage")]
        public async Task<IActionResult> Resolve(int id, [FromBody] ResolvePendingActionDto dto)
        {
            var (success, error) = await _service.ResolveAsync(id, dto, GetUserId(), GetUserName());
            if (!success)
                return BadRequest(new { message = error });

            return Ok(new { message = $"Request {dto.Status.ToLower()}." });
        }

        // DELETE: /api/approvals/5  = delete one request (needs Delete)
        [HttpDelete("{id}")]
        [RequirePermission("Approvals", "Delete")]
        public async Task<IActionResult> Delete(int id)
        {
            var deleted = await _service.DeleteAsync(id);
            if (!deleted)
                return NotFound(new { message = "Request not found." });

            return Ok(new { message = "Request deleted." });
        }

        // DELETE: /api/approvals  = delete all requests (needs Delete)
        [HttpDelete]
        [RequirePermission("Approvals", "Delete")]
        public async Task<IActionResult> DeleteAll()
        {
            await _service.DeleteAllAsync();
            return Ok(new { message = "All requests deleted." });
        }
    }
}
