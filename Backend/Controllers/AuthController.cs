using Backend.Auth;
using Backend.Demo;
using Backend.Models.DTOs;
using Backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

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
            var result = await _authService.RegisterAsync(dto);
            if (result == null)
                return BadRequest(new { message = "Username already exists" });

            return Ok(result);
        }

        // POST: /api/auth/login   log in and get a token
        // Always checks the real accounts, even if the browser still holds a demo token.
        [HttpPost("login")]
        [UseMainDatabase]
        public async Task<IActionResult> Login([FromBody] LoginDto dto)
        {
            var (success, error, data) = await _authService.LoginAsync(dto);
            if (!success)
                return Unauthorized(new { message = error });

            return Ok(data);
        }
    }
}
