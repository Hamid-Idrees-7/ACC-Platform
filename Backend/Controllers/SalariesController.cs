using System.Security.Claims;
using Backend.Auth;
using Backend.Models.DTOs;
using Backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Backend.Controllers
{
    // API endpoints for salaries/payroll. Base route: /api/salaries
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class SalariesController : ControllerBase
    {
        private readonly ISalaryService _service;

        public SalariesController(ISalaryService service)
        {
            _service = service;
        }

        private int GetUserId()
        {
            var idClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return int.TryParse(idClaim, out var id) ? id : 0;
        }

        // GET /api/salaries?year=&month=&projectId=
        [HttpGet]
        [RequirePermission("Salaries", "View")]
        public async Task<IActionResult> GetPeriod([FromQuery] int year, [FromQuery] int month, [FromQuery] int? projectId)
        {
            var now = DateTime.Now;
            if (year == 0) year = now.Year;
            if (month == 0) month = now.Month;

            var data = await _service.GetPeriodAsync(year, month, projectId);
            return Ok(data);
        }

        // POST /api/salaries/pay
        [HttpPost("pay")]
        [RequirePermission("Salaries", "Manage")]
        public async Task<IActionResult> Pay([FromBody] PaySalaryDto dto)
        {
            var data = await _service.PayAsync(dto, GetUserId());
            return Ok(data);
        }

        // DELETE /api/salaries/5 — undo a payment (back to Pending)
        [HttpDelete("{paymentId}")]
        [RequirePermission("Salaries", "Manage")]
        public async Task<IActionResult> Revert(int paymentId)
        {
            var data = await _service.RevertAsync(paymentId);
            if (data == null)
                return NotFound(new { message = "Payment not found" });

            return Ok(data);
        }

        // GET /api/salaries/5/payslip?year=&month=
        [HttpGet("{employeeId}/payslip")]
        [RequirePermission("Salaries", "View")]
        public async Task<IActionResult> Payslip(int employeeId, [FromQuery] int year, [FromQuery] int month)
        {
            var slip = await _service.GetPayslipAsync(employeeId, year, month);
            if (slip == null)
                return NotFound(new { message = "Employee not found" });

            return Ok(slip);
        }
    }
}
