using Backend.Auth;
using Backend.Demo;
using Backend.Models.DTOs;
using Backend.Models.Entities;
using Backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace Backend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]   // all profile actions require login
    public class ProfileController : ControllerBase
    {
        private readonly IProfileService _service;
        private readonly IPreferenceService _preferenceService;
        private readonly ISessionService _sessions;

        public ProfileController(IProfileService service, IPreferenceService preferenceService, ISessionService sessions)
        {
            _service = service;
            _preferenceService = preferenceService;
            _sessions = sessions;
        }

        // Helper: get the logged-in user's ID from the JWT token
        private int GetUserId()
        {
            var id = User.FindFirstValue(ClaimTypes.NameIdentifier);
            return int.Parse(id!);
        }

        // The session (sign-in) this request is made from
        private int? GetLoginId() =>
            int.TryParse(User.FindFirstValue(SessionClaims.LoginId), out var id) ? id : null;

        // GET my profile
        [HttpGet]
        public async Task<IActionResult> GetProfile()
        {
            var profile = await _service.GetProfileAsync(GetUserId());
            if (profile == null) return NotFound();
            return Ok(profile);
        }

        // UPDATE my profile
        [HttpPut]
        public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileDto dto)
        {
            var (success, message, field) = await _service.UpdateProfileAsync(GetUserId(), dto);
            if (!success) return BadRequest(new { message, field });
            return Ok(new { message });
        }

        // Demo logins are shared by the role switcher, so their sign-in details stay fixed.
        private bool IsDemoAccount() => User.HasClaim(c => c.Type == DemoClaims.SessionId);

        // CHANGE username
        [HttpPut("username")]
        public async Task<IActionResult> ChangeUsername([FromBody] ChangeUsernameDto dto)
        {
            if (IsDemoAccount())
                return BadRequest(new { message = "The username can't be changed on a demo account." });

            var (success, error) = await _service.ChangeUsernameAsync(GetUserId(), dto);
            if (!success)
                return BadRequest(new { message = error });

            return Ok(new { message = "Username changed successfully" });
        }

        // POST: /api/profile/verify-password
        [HttpPost("verify-password")]
        public async Task<IActionResult> VerifyPassword([FromBody] VerifyPasswordDto dto)
        {
            var ok = await _service.VerifyPasswordAsync(GetUserId(), dto.Password);
            if (!ok)
                return BadRequest(new { message = "Password is incorrect." });

            return Ok(new { message = "Verified" });
        }

        // CHANGE password
        [HttpPut("password")]
        public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordDto dto)
        {
            if (IsDemoAccount())
                return BadRequest(new { message = "The password can't be changed on a demo account." });

            var (success, message, field) = await _service.ChangePasswordAsync(GetUserId(), dto, GetLoginId());
            if (!success) return BadRequest(new { message, field });
            return Ok(new { message });
        }

        // UPDATE profile picture
        [HttpPut("picture")]
        public async Task<IActionResult> UpdatePicture([FromBody] UpdatePictureDto dto)
        {
            var (success, message) = await _service.UpdatePictureAsync(GetUserId(), dto.ProfilePicture);
            if (!success) return BadRequest(new { message });
            return Ok(new { message });
        }

        // GET my sessions and sign-in history (Settings > Security)
        [HttpGet("security")]
        public async Task<IActionResult> GetSecurity()
        {
            return Ok(await _sessions.GetOverviewAsync(GetUserId(), GetLoginId()));
        }

        // Sign out one of my other devices
        [HttpPost("sessions/{id:int}/sign-out")]
        public async Task<IActionResult> SignOutSession(int id)
        {
            if (id == GetLoginId())
                return BadRequest(new { message = "Use Logout to sign out of this device." });

            var ended = await _sessions.EndOtherAsync(GetUserId(), id, GetLoginId());
            if (!ended)
                return NotFound(new { message = "That session has already ended." });

            return Ok(new { message = "Signed out of that device." });
        }

        // Sign out of every device except this one
        [HttpPost("sessions/sign-out-others")]
        public async Task<IActionResult> SignOutOthers()
        {
            var ended = await _sessions.EndAllAsync(GetUserId(), GetLoginId(), SessionEndReasons.SignedOutRemotely);
            return Ok(new
            {
                message = ended == 0
                    ? "No other devices were signed in."
                    : $"Signed out of {ended} other device{(ended == 1 ? "" : "s")}.",
                ended
            });
        }

        // GET my display settings (theme, number, date and time format)
        [HttpGet("preferences")]
        public async Task<IActionResult> GetPreferences()
        {
            return Ok(await _preferenceService.GetAsync(GetUserId()));
        }

        // SAVE my display settings
        [HttpPut("preferences")]
        public async Task<IActionResult> SavePreferences([FromBody] PreferencesDto dto)
        {
            var (saved, error) = await _preferenceService.SaveAsync(GetUserId(), dto);
            if (error != null) return BadRequest(new { message = error });
            return Ok(saved);
        }
    }
}