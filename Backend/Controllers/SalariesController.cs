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
        private readonly INotificationService _notifications;
        private readonly ICompanySettingsService _company;

        public SalariesController(ISalaryService service, INotificationService notifications, ICompanySettingsService company)
        {
            _service = service;
            _notifications = notifications;
            _company = company;
        }

        private string GetUserName() =>
            User.FindFirst("FullName")?.Value ?? User.FindFirst(ClaimTypes.Name)?.Value ?? "";

        private async Task NotifyAsync(string personalTitle, string personalText, string activityTitle, string activityText, string link)
        {
            await _notifications.NotifyPersonalAsync(GetUserId(), NotificationCategories.Salary, personalTitle, personalText, link: link);
            await _notifications.NotifyAdminsActivityAsync(NotificationCategories.Salary, activityTitle, $"{GetUserName()} {activityText}", link: link);
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
            var alreadyPaid = await _service.IsLinePaidAsync(dto);
            var data = await _service.PayAsync(dto, GetUserId());

            if (!alreadyPaid)
            {
                var name = await _service.EmployeeNameAsync(dto.EmployeeID);
                var what = $"{name}'s salary for {SalaryService.PeriodLabel(dto.Year, dto.Month)}: {await _company.FormatMoneyAsync(dto.PaidAmount)}.";
                await NotifyAsync("Salary paid", $"You paid {what}", "Salary paid", $"paid {what}",
                    NotificationLinks.Salaries(dto.Year, dto.Month));
            }

            return Ok(data);
        }

        // DELETE /api/salaries/5 — undo a payment (back to Pending)
        [HttpDelete("{paymentId}")]
        [RequirePermission("Salaries", "Manage")]
        public async Task<IActionResult> Revert(int paymentId)
        {
            var payment = await _service.DescribePaymentAsync(paymentId);
            var data = await _service.RevertAsync(paymentId);
            if (data == null)
                return NotFound(new { message = "Payment not found" });

            if (payment != null)
            {
                var what = $"{payment.EmployeeName}'s salary payment for {SalaryService.PeriodLabel(payment.Year, payment.Month)} ({await _company.FormatMoneyAsync(payment.Amount)}). It is pending again.";
                await NotifyAsync("Salary payment undone", $"You undid {what}", "Salary payment undone", $"undid {what}",
                    NotificationLinks.Salaries(payment.Year, payment.Month));
            }

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
