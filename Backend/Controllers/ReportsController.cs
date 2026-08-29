using Backend.Auth;
using Backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Backend.Controllers
{
    // Company reports. Base route: /api/reports. Read-only — View permission only.
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class ReportsController : ControllerBase
    {
        private readonly IReportsService _service;

        public ReportsController(IReportsService service)
        {
            _service = service;
        }

        // GET /api/reports — the full company report (financial, projects, materials, workforce)
        [HttpGet]
        [RequirePermission("Reports", "View")]
        public async Task<IActionResult> Get()
        {
            return Ok(await _service.GetReportsAsync());
        }
    }
}
