using System.Security.Claims;
using Backend.Auth;
using Backend.Models.DTOs;
using Backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Backend.Controllers
{
    // Settings > Company. Everyone signed in can read it (invoices, payslips and the
    // currency symbol need it); only the Admin can change it.
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class CompanyController : ControllerBase
    {
        private readonly ICompanySettingsService _service;

        public CompanyController(ICompanySettingsService service)
        {
            _service = service;
        }

        private string GetUserName() =>
            User.FindFirst("FullName")?.Value ?? User.FindFirst(ClaimTypes.Name)?.Value ?? "";

        // GET: /api/company
        [HttpGet]
        public async Task<IActionResult> Get()
        {
            return Ok(await _service.GetAsync());
        }

        // PUT: /api/company  - Admin only
        [HttpPut]
        [AdminOnly]
        public async Task<IActionResult> Save([FromBody] SaveCompanySettingsDto dto)
        {
            var (saved, error, field) = await _service.SaveAsync(dto, GetUserName());
            if (error != null) return BadRequest(new { message = error, field });
            return Ok(saved);
        }
    }
}
