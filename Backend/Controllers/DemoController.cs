using Backend.Auth;
using Backend.Demo;
using Backend.Models.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Backend.Controllers
{
    // Public visitor demo. Base route: /api/demo
    // Each visitor gets a private database of their own; see Backend/Demo for how it works.
    [ApiController]
    [Route("api/[controller]")]
    public class DemoController : ControllerBase
    {
        private readonly DemoManager _manager;
        private readonly TokenService _tokens;

        public DemoController(DemoManager manager, TokenService tokens)
        {
            _manager = manager;
            _tokens = tokens;
        }

        // GET /api/demo/status — should the login page offer the demo, and is a seat free?
        [HttpGet("status")]
        [AllowAnonymous]
        [UseMainDatabase]
        public async Task<IActionResult> Status(CancellationToken ct)
        {
            var (enabled, available) = await _manager.GetStatusAsync(ct);
            return Ok(new DemoStatusDto
            {
                Enabled = enabled,
                Available = available,
                SessionMinutes = _manager.SessionMinutes
            });
        }

        // POST /api/demo/start — "Login as Visitor". No password; rate limited per IP.
        [HttpPost("start")]
        [AllowAnonymous]
        [UseMainDatabase]
        [EnableRateLimiting(DemoOptions.StartRateLimitPolicy)]
        public async Task<IActionResult> Start([FromBody] DemoRoleDto dto, CancellationToken ct)
        {
            var result = await _manager.StartAsync(dto.Role ?? "admin", ct);
            if (!result.Success)
                return StatusCode(result.StatusCode, new { message = result.Error });

            return Ok(BuildResponse(result));
        }

        // POST /api/demo/switch — switch between Admin / Manager / Site Engineer in the same demo.
        [HttpPost("switch")]
        [Authorize]
        public async Task<IActionResult> Switch([FromBody] DemoRoleDto dto, CancellationToken ct)
        {
            if (!TryGetDemoSession(out var sessionId, out var database))
                return StatusCode(403, new { message = "Role switching is only available in the demo." });

            var result = await _manager.SwitchAsync(sessionId, database, dto.Role ?? string.Empty, ct);
            if (!result.Success)
            {
                if (result.StatusCode == 401)
                    return Unauthorized(new { code = "demo_expired", message = result.Error });
                return StatusCode(result.StatusCode, new { message = result.Error });
            }

            return Ok(BuildResponse(result));
        }

        // POST /api/demo/view-as/7 — see the system as another user in the visitor's own demo
        // (e.g. one they created and gave permissions to). Only works inside a demo session, and
        // only ever looks up users in that visitor's private database.
        [HttpPost("view-as/{userId:int}")]
        [Authorize]
        [AdminOnly]
        public async Task<IActionResult> ViewAs(int userId, CancellationToken ct)
        {
            if (!TryGetDemoSession(out var sessionId, out var database))
                return StatusCode(403, new { message = "View as is only available in the demo." });

            var result = await _manager.ViewAsAsync(sessionId, database, userId, ct);
            if (!result.Success)
            {
                if (result.StatusCode == 401)
                    return Unauthorized(new { code = "demo_expired", message = result.Error });
                return StatusCode(result.StatusCode, new { message = result.Error });
            }

            return Ok(BuildResponse(result));
        }

        // POST /api/demo/end — "Exit demo": frees the seat and deletes the visitor's database.
        [HttpPost("end")]
        [Authorize]
        public async Task<IActionResult> End(CancellationToken ct)
        {
            if (TryGetDemoSession(out var sessionId, out var database))
                await _manager.EndAsync(sessionId, database, ct);

            return Ok(new { message = "Demo ended." });
        }

        private bool TryGetDemoSession(out int sessionId, out string database)
        {
            database = User.FindFirst(DemoClaims.Database)?.Value ?? string.Empty;
            var sessionClaim = User.FindFirst(DemoClaims.SessionId)?.Value;
            return int.TryParse(sessionClaim, out sessionId) && DemoDbFactory.IsValidName(database);
        }

        private DemoAuthResponseDto BuildResponse(DemoResult result)
        {
            var user = result.User!;
            return new DemoAuthResponseDto
            {
                Token = _tokens.CreateDemoToken(user, result.SessionId, result.DatabaseName, result.RoleKey, result.ExpiresAtUtc),
                UserID = user.UserID,
                Username = user.Username,
                FullName = user.FullName,
                Role = user.Role,
                ProfilePicture = user.ProfilePicture,
                IsDemo = true,
                DemoRole = result.RoleKey,
                DemoRoleLabel = result.RoleLabel,
                DemoSecondsLeft = (int)Math.Max(0, (result.ExpiresAtUtc - DateTime.UtcNow).TotalSeconds)
            };
        }
    }
}
