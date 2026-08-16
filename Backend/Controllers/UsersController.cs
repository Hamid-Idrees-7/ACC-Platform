using System.Security.Claims;
using Backend.Auth;
using Backend.Models.DTOs;
using Backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Backend.Controllers
{
    // API endpoints for managing users. Base route: /api/users
    // Users management is an admin-only area - never delegated through permissions.
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    [AdminOnly]
    public class UsersController : ControllerBase
    {
        private readonly IUserService _service;

        public UsersController(IUserService service)
        {
            _service = service;
        }

        // Get the ID of the currently logged-in user from the JWT token
        private int GetCurrentUserId()
        {
            var idClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return int.TryParse(idClaim, out var id) ? id : 0;
        }

        // GET: /api/users
        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var users = await _service.GetAllUsersAsync();
            return Ok(users);
        }

        // GET: /api/users/5
        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(int id)
        {
            var user = await _service.GetUserByIdAsync(id);
            if (user == null)
                return NotFound(new { message = "User not found" });

            return Ok(user);
        }

        // POST: /api/users
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateUserDto dto)
        {
            var (success, error, user) = await _service.CreateUserAsync(dto);
            if (!success)
                return BadRequest(new { message = error });

            return CreatedAtAction(nameof(GetById), new { id = user!.UserID }, user);
        }

        // PUT: /api/users/5
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] CreateUserDto dto)
        {
            var (success, error, user) = await _service.UpdateUserAsync(id, dto);
            if (!success)
                return BadRequest(new { message = error });

            return Ok(user);
        }

        // PUT: /api/users/5/toggle-status
        [HttpPut("{id}/toggle-status")]
        public async Task<IActionResult> ToggleStatus(int id)
        {
            var (success, error) = await _service.ToggleStatusAsync(id, GetCurrentUserId());
            if (!success)
                return BadRequest(new { message = error });

            return Ok(new { message = "Status updated" });
        }

        // DELETE: /api/users/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var (success, error) = await _service.DeleteUserAsync(id, GetCurrentUserId());
            if (!success)
                return BadRequest(new { message = error });

            return Ok(new { message = "User deleted successfully" });
        }
    }
}
