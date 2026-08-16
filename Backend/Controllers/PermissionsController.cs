using System.Security.Claims;
using Backend.Auth;
using Backend.Models.DTOs;
using Backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Backend.Controllers
{
    // Manages user permissions (Control Unit).
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class PermissionsController : ControllerBase
    {
        private readonly IPermissionService _service;

        public PermissionsController(IPermissionService service)
        {
            _service = service;
        }

        private int GetCurrentUserId()
        {
            var idClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return int.TryParse(idClaim, out var id) ? id : 0;
        }

        private bool IsAdmin()
        {
            var role = User.FindFirst(ClaimTypes.Role)?.Value;
            return string.Equals(role, "Admin", StringComparison.OrdinalIgnoreCase);
        }

        // GET: /api/permissions/user/5
        // A user may read their OWN permissions (needed for their sidebar/buttons).
        // Admins may read anyone's.
        [HttpGet("user/{userId}")]
        public async Task<IActionResult> GetForUser(int userId)
        {
            if (!IsAdmin() && userId != GetCurrentUserId())
                return StatusCode(403, new { message = "You can only view your own permissions." });

            var perms = await _service.GetUserPermissionsAsync(userId);
            return Ok(perms);
        }

        // GET: /api/permissions/counts  - Admin only
        [HttpGet("counts")]
        [AdminOnly]
        public async Task<IActionResult> GetCounts()
        {
            var counts = await _service.GetModuleCountsAsync();
            return Ok(counts);
        }

        // PUT: /api/permissions  - set a permission - Admin only
        [HttpPut]
        [AdminOnly]
        public async Task<IActionResult> Set([FromBody] SetPermissionDto dto)
        {
            await _service.SetPermissionAsync(dto);
            return Ok(new { message = "Permission updated" });
        }
    }
}
