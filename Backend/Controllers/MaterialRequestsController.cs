using System.Security.Claims;
using Backend.Auth;
using Backend.Models.DTOs;
using Backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Backend.Controllers
{
    // Admin/store side of the field material-request flow. Base route: /api/materialrequests.
    // Guarded by its own MaterialRequests permission (separate from Materials) so an
    // engineer with Materials access can never approve/reject their own field requests.
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class MaterialRequestsController : ControllerBase
    {
        private readonly IMaterialRequestService _service;

        public MaterialRequestsController(IMaterialRequestService service)
        {
            _service = service;
        }

        private int GetUserId()
        {
            var idClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return int.TryParse(idClaim, out var id) ? id : 0;
        }

        // GET /api/materialrequests — all requests (pending + resolved)
        [HttpGet]
        [RequirePermission("MaterialRequests", "View")]
        public async Task<IActionResult> GetAll()
        {
            return Ok(await _service.GetAllAsync());
        }

        // GET /api/materialrequests/pending-count — for the dashboard badge
        [HttpGet("pending-count")]
        [RequirePermission("MaterialRequests", "View")]
        public async Task<IActionResult> PendingCount()
        {
            return Ok(new { count = await _service.GetPendingCountAsync() });
        }

        // POST /api/materialrequests/5/approve — approve + issue the stock
        [HttpPost("{id}/approve")]
        [RequirePermission("MaterialRequests", "Manage")]
        public async Task<IActionResult> Approve(int id)
        {
            var (ok, error) = await _service.ApproveAsync(id, GetUserId());
            if (!ok)
                return BadRequest(new { message = error });
            return Ok(new { message = "Request approved and material issued." });
        }

        // POST /api/materialrequests/5/reject — reject with an optional reason
        [HttpPost("{id}/reject")]
        [RequirePermission("MaterialRequests", "Manage")]
        public async Task<IActionResult> Reject(int id, [FromBody] ResolveRequestDto dto)
        {
            var (ok, error) = await _service.RejectAsync(id, GetUserId(), dto?.Note);
            if (!ok)
                return BadRequest(new { message = error });
            return Ok(new { message = "Request rejected." });
        }
    }
}
