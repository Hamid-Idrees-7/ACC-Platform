using Backend.Models.DTOs;
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

        public ProfileController(IProfileService service)
        {
            _service = service;
        }

        // Helper: get the logged-in user's ID from the JWT token
        private int GetUserId()
        {
            var id = User.FindFirstValue(ClaimTypes.NameIdentifier);
            return int.Parse(id!);
        }

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
            var (success, message) = await _service.UpdateProfileAsync(GetUserId(), dto);
            if (!success) return BadRequest(new { message });
            return Ok(new { message });
        }

        // CHANGE password
        [HttpPut("password")]
        public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordDto dto)
        {
            var (success, message) = await _service.ChangePasswordAsync(GetUserId(), dto);
            if (!success) return BadRequest(new { message });
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

    }
}