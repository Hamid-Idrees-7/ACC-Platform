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
    // Sign-in, sessions and password reset. Base route: /api/auth
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly IAuthService _authService;
        private readonly IPasswordResetService _passwordReset;

        public AuthController(IAuthService authService, IPasswordResetService passwordReset)
        {
            _authService = authService;
            _passwordReset = passwordReset;
        }

        // POST: /api/auth/login  = sign in and get a token
        // Always checks the real accounts, even if the browser still holds a demo token.
        // Also rate limited per IP address, on top of the per-username pause in AuthService.
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

        // POST: /api/auth/refresh  = a new token for the same session while the user keeps working
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

        // GET: /api/auth/ping  = the open app saying the user is still active, so the server
        // doesn't treat the session as idle while someone reads or types without saving.
        [HttpGet("ping")]
        [Authorize]
        public IActionResult Ping() => NoContent();

        // POST: /api/auth/logout  = end this session on the server. Always answers OK, even when
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

        // POST: /api/auth/forgot-password  = email a reset link
        // The answer is the same whether the account exists or not.
        [HttpPost("forgot-password")]
        [AllowAnonymous]
        [SkipSessionCheck]
        [UseMainDatabase]
        [EnableRateLimiting(SecurityOptions.PasswordResetRateLimitPolicy)]
        public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Login))
                return BadRequest(new { message = "Enter your username or email." });

            await _passwordReset.RequestAsync(dto.Login, ClientInfo.From(HttpContext));
            return Ok(new
            {
                message = "If that account exists, we've emailed it a reset link. " +
                          $"It works for {SecurityOptions.ResetLinkLifetime.TotalMinutes:0} minutes. Check your spam folder too."
            });
        }

        // POST: /api/auth/reset-password/check  = is the email link still valid?
        [HttpPost("reset-password/check")]
        [AllowAnonymous]
        [SkipSessionCheck]
        [UseMainDatabase]
        [EnableRateLimiting(SecurityOptions.PasswordResetRateLimitPolicy)]
        public async Task<IActionResult> CheckResetCode([FromBody] ResetCodeDto dto)
        {
            var username = await _passwordReset.CheckAsync(dto.Code);
            if (username == null)
                return BadRequest(new { message = "This link has expired or was already used. Please ask for a new one." });

            return Ok(new { username });
        }

        // POST: /api/auth/reset-password  = set the new password with the code from the email
        [HttpPost("reset-password")]
        [AllowAnonymous]
        [SkipSessionCheck]
        [UseMainDatabase]
        [EnableRateLimiting(SecurityOptions.PasswordResetRateLimitPolicy)]
        public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordDto dto)
        {
            var (success, message, field) = await _passwordReset.ResetAsync(dto.Code, dto.NewPassword, ClientInfo.From(HttpContext));
            if (!success)
                return BadRequest(new { message, field });

            return Ok(new { message });
        }

        private bool TryGetSession(out int userId, out int loginId)
        {
            loginId = 0;
            return int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out userId) &&
                   int.TryParse(User.FindFirstValue(SessionClaims.LoginId), out loginId);
        }
    }
}
