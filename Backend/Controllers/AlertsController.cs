using System.Security.Claims;
using Backend.Auth;
using Backend.Models.DTOs;
using Backend.Models.Entities;
using Backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Backend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class AlertsController : ControllerBase
    {
        private readonly IAlertService _service;
        private readonly IAlertCheckService _checks;

        public AlertsController(IAlertService service, IAlertCheckService checks)
        {
            _service = service;
            _checks = checks;
        }

        private int GetUserId() =>
            int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var id) ? id : 0;

        private bool IsAdmin() =>
            string.Equals(User.FindFirst(ClaimTypes.Role)?.Value, "Admin", StringComparison.OrdinalIgnoreCase);

        private string ActorName() =>
            User.FindFirst("FullName")?.Value ?? User.FindFirst(ClaimTypes.Name)?.Value ?? "";

        [HttpGet]
        public async Task<IActionResult> GetMine([FromQuery] string status = AlertStatuses.Open)
        {
            var wanted = string.Equals(status, AlertStatuses.Resolved, StringComparison.OrdinalIgnoreCase)
                ? AlertStatuses.Resolved
                : AlertStatuses.Open;
            return Ok(await _service.GetForUserAsync(GetUserId(), IsAdmin(), wanted));
        }

        [HttpGet("summary")]
        public async Task<IActionResult> GetSummary()
        {
            return Ok(await _service.GetSummaryAsync(GetUserId(), IsAdmin()));
        }

        [HttpPut("{id}/resolve")]
        public async Task<IActionResult> Resolve(int id)
        {
            var ok = await _service.ResolveAsync(id, GetUserId());
            if (!ok) return NotFound(new { message = "This alert can't be marked as resolved." });
            return Ok(new { message = "Alert resolved." });
        }

        [HttpPost("check")]
        [AdminOnly]
        public async Task<IActionResult> CheckNow(CancellationToken ct)
        {
            await _checks.RunAsync(ct);
            return Ok(await _service.GetSummaryAsync(GetUserId(), IsAdmin()));
        }

        [HttpGet("rules")]
        [AdminOnly]
        public async Task<IActionResult> GetRules()
        {
            return Ok(await _service.GetRulesAsync());
        }

        [HttpPut("rules/{type}")]
        [AdminOnly]
        public async Task<IActionResult> SaveRule(string type, [FromBody] SaveAlertRuleDto dto)
        {
            var (rules, error) = await _service.SaveRuleAsync(type, dto, ActorName());
            if (error != null) return BadRequest(new { message = error, field = "threshold" });
            return Ok(rules);
        }
    }
}
