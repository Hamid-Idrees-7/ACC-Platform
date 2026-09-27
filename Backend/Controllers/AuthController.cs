using System.Security.Claims;
using Backend.Auth;
using Backend.Demo;
using Backend.Models.DTOs;
using Backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Backend.Controllers
{
    // API endpoints for authentication. Base route: /api/auth
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly IAuthService _authService;

        public AuthController(IAuthService authService)
        {
            _authService = authService;
        }

        // POST: /api/auth/register   create a new user
        // Admin only: there is no public sign-up. Accounts (and their roles) are created by an
        // administrator, so nobody can register themselves with an elevated role.
        [HttpPost("register")]
        [Authorize]
        [AdminOnly]
        public async Task<IActionResult> Register([FromBody] RegisterDto dto)
        {
            var (success, error, userId) = await _authService.RegisterAsync(dto);
            if (!success)
                return BadRequest(new { message = error });

            return Ok(new { message = "User created.", userID = userId });
        }

        // POST: /api/auth/login   log in and get a token
        // Always checks the real accounts, even if the browser still holds a demo token.
        // Limited per IP address as well (on top of the per-username pause in AuthService).
        [HttpPost("login")]
        [UseMainDatabase]
        [EnableRateLimiting(SecurityOptions.LoginRateLimitPolicy)]
        public async Task<IActionResult> Login([FromBody] LoginDto dto)
        {
            var result = await _authService.LoginAsync(dto, ClientInfo.From(HttpContext));
            if (!result.Success)
                return StatusCode(result.StatusCode, new { message = result.Error });

            return Ok(result.Data);
        }

        // POST: /api/auth/refresh   a fresh token for the same session (the user is still working)
        // Demo tokens end with the demo and are never renewed.
        [HttpPost("refresh")]
        [Authorize]
        public async Task<IActionResult> Refresh()
        {
            if (User.HasClaim(c => c.Type == DemoClaims.SessionId))
                return BadRequest(new { message = "Demo sessions can't be renewed." });

            if (!TryGetSession(out var userId, out var loginId))
                return Unauthorized(new { code = "session_ended", message = SessionCheck.MessageFor(null) });

            var data = await _authService.RefreshAsync(userId, loginId);
            if (data == null)
                return Unauthorized(new { code = "session_ended", reason = SessionCheck.Expired, message = SessionCheck.MessageFor(SessionCheck.Expired) });

            return Ok(data);
        }

        // POST: /api/auth/logout   end this session on the server. Always answers OK, even when
        // the session had already ended, so signing out never fails.
        [HttpPost("logout")]
        [AllowAnonymous]
        [SkipSessionCheck]
        public async Task<IActionResult> Logout([FromBody] LogoutDto? dto)
        {
            if (TryGetSession(out var userId, out var loginId))
                await _authService.LogoutAsync(userId, loginId, dto?.Reason == "idle");

            return Ok(new { message = "Signed out." });
        }

        private bool TryGetSession(out int userId, out int loginId)
        {
            loginId = 0;
            return int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out userId) &&
                   int.TryParse(User.FindFirstValue(SessionClaims.LoginId), out loginId);
        }
    }
}
