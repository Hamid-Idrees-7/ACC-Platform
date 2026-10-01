using System.Security.Claims;
using Backend.Auth;
using Backend.Demo;
using Backend.Models.DTOs;
using Backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Backend.Controllers
{
    // API endpoints for managing users. Base route: /api/users
    // Users management is admin only and is never given out through permissions.
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

        private int GetCurrentUserId()
        {
            var idClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return int.TryParse(idClaim, out var id) ? id : 0;
        }

        // Live demo: the three built-in demo logins keep their username, password, role and
        // status, so the role switcher always works. Their access can still be changed in Control Unit.
        private const string DemoLoginLocked =
            "Built-in demo logins keep their username, password, role and status. You can still change their access in Control Unit.";

        private bool InDemo() => User.HasClaim(c => c.Type == DemoClaims.SessionId);

        // The session this request is made from (kept signed in when admins edit themselves)
        private int? GetCurrentLoginId() =>
            int.TryParse(User.FindFirst(SessionClaims.LoginId)?.Value, out var id) ? id : null;

        private async Task<UserDto?> GetLockedDemoLoginAsync(int id)
        {
            if (!InDemo()) return null;
            var target = await _service.GetUserByIdAsync(id);
            return target != null && DemoSeeder.IsBuiltInLogin(target.Username) ? target : null;
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
            var locked = await GetLockedDemoLoginAsync(id);
            if (locked != null &&
                (dto.Username?.Trim() != locked.Username ||
                 dto.Role?.Trim() != locked.Role ||
                 !string.IsNullOrWhiteSpace(dto.Password) ||
                 !dto.IsActive))
                return BadRequest(new { message = DemoLoginLocked });

            var keep = id == GetCurrentUserId() ? GetCurrentLoginId() : null;
            var (success, error, user) = await _service.UpdateUserAsync(id, dto, keep);
            if (!success)
                return BadRequest(new { message = error });

            return Ok(user);
        }

        // PUT: /api/users/5/toggle-status
        [HttpPut("{id}/toggle-status")]
        public async Task<IActionResult> ToggleStatus(int id)
        {
            if (await GetLockedDemoLoginAsync(id) != null)
                return BadRequest(new { message = DemoLoginLocked });

            var (success, error) = await _service.ToggleStatusAsync(id, GetCurrentUserId());
            if (!success)
                return BadRequest(new { message = error });

            return Ok(new { message = "Status updated" });
        }

        // GET: /api/users/5/security  = one user's sessions and sign-in history
        [HttpGet("{id}/security")]
        public async Task<IActionResult> GetSecurity(int id)
        {
            var overview = await _service.GetSecurityAsync(id);
            if (overview == null)
                return NotFound(new { message = "User not found" });

            return Ok(overview);
        }

        // POST: /api/users/5/sign-out  = sign the user out of every device (eg a lost phone)
        [HttpPost("{id}/sign-out")]
        public async Task<IActionResult> SignOutEverywhere(int id)
        {
            var (success, error, ended) = await _service.SignOutEverywhereAsync(id, GetCurrentUserId());
            if (!success)
                return BadRequest(new { message = error });

            return Ok(new
            {
                message = ended == 0
                    ? "The user was not signed in anywhere."
                    : $"Signed out of {ended} device{(ended == 1 ? "" : "s")}.",
                ended
            });
        }

        // DELETE: /api/users/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            if (await GetLockedDemoLoginAsync(id) != null)
                return BadRequest(new { message = DemoLoginLocked });

            var (success, error) = await _service.DeleteUserAsync(id, GetCurrentUserId());
            if (!success)
                return BadRequest(new { message = error });

            return Ok(new { message = "User deleted successfully" });
        }
    }
}
