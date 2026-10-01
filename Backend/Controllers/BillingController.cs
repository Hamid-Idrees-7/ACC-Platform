using System.Security.Claims;
using Backend.Auth;
using Backend.Models.DTOs;
using Backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Backend.Controllers
{
    // Billing and invoices. Base route: /api/billing
    // Reading needs View; anything that changes data needs Manage.
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class BillingController : ControllerBase
    {
        private readonly IBillingService _service;
        private readonly INotificationService _notifications;
        private readonly ICompanySettingsService _company;

        public BillingController(IBillingService service, INotificationService notifications, ICompanySettingsService company)
        {
            _service = service;
            _notifications = notifications;
            _company = company;
        }

        private int GetUserId() =>
            int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var id) ? id : 0;

        private string GetUserName() =>
            User.FindFirst("FullName")?.Value ?? User.FindFirst(ClaimTypes.Name)?.Value ?? "";

        private async Task NotifyAsync(string personalTitle, string personalText, string activityTitle, string activityText, string link)
        {
            await _notifications.NotifyPersonalAsync(GetUserId(), NotificationCategories.Billing, personalTitle, personalText, link: link);
            await _notifications.NotifyAdminsActivityAsync(NotificationCategories.Billing, activityTitle, $"{GetUserName()} {activityText}", link: link);
        }

        // GET: /api/billing  = overview stats and a card per project
        [HttpGet]
        [RequirePermission("Billing", "View")]
        public async Task<IActionResult> GetOverview()
        {
            return Ok(await _service.GetOverviewAsync());
        }

        // GET: /api/billing/project/5  = one project's invoices and phase options
        [HttpGet("project/{projectId}")]
        [RequirePermission("Billing", "View")]
        public async Task<IActionResult> GetProject(int projectId)
        {
            var data = await _service.GetProjectBillingAsync(projectId);
            if (data == null)
                return NotFound(new { message = "Project not found" });
            return Ok(data);
        }

        // POST: /api/billing/invoices  = create an invoice
        [HttpPost("invoices")]
        [RequirePermission("Billing", "Manage")]
        public async Task<IActionResult> CreateInvoice([FromBody] CreateInvoiceDto dto)
        {
            var (id, error) = await _service.CreateInvoiceAsync(dto);
            if (error != null)
                return BadRequest(new { message = error });

            var invoice = await _service.DescribeInvoiceAsync(id!.Value);
            if (invoice != null)
            {
                var what = $"invoice {invoice.InvoiceNumber} for {invoice.ProjectTitle}: {await _company.FormatMoneyAsync(invoice.Total)}.";
                await NotifyAsync("Invoice created", $"You created {what}", "New invoice", $"created {what}",
                    NotificationLinks.Invoice(invoice.ProjectID, invoice.InvoiceID));
            }

            return Ok(new { invoiceId = id });
        }

        // PUT: /api/billing/invoices/5  = edit an invoice
        [HttpPut("invoices/{id}")]
        [RequirePermission("Billing", "Manage")]
        public async Task<IActionResult> UpdateInvoice(int id, [FromBody] CreateInvoiceDto dto)
        {
            var (found, error) = await _service.UpdateInvoiceAsync(id, dto);
            if (!found)
                return NotFound(new { message = "Invoice not found" });
            if (error != null)
                return BadRequest(new { message = error });

            var invoice = await _service.DescribeInvoiceAsync(id);
            if (invoice != null)
            {
                var what = $"invoice {invoice.InvoiceNumber} for {invoice.ProjectTitle}. New total: {await _company.FormatMoneyAsync(invoice.Total)}.";
                await NotifyAsync("Invoice updated", $"You updated {what}", "Invoice updated", $"updated {what}",
                    NotificationLinks.Invoice(invoice.ProjectID, invoice.InvoiceID));
            }

            return Ok(new { message = "Invoice updated" });
        }

        // DELETE: /api/billing/invoices/5  = delete an invoice with its items and payments
        [HttpDelete("invoices/{id}")]
        [RequirePermission("Billing", "Manage")]
        public async Task<IActionResult> DeleteInvoice(int id)
        {
            var invoice = await _service.DescribeInvoiceAsync(id);
            var ok = await _service.DeleteInvoiceAsync(id);
            if (!ok)
                return NotFound(new { message = "Invoice not found" });

            if (invoice != null)
            {
                var what = $"invoice {invoice.InvoiceNumber} of {invoice.ProjectTitle} ({await _company.FormatMoneyAsync(invoice.Total)}).";
                await NotifyAsync("Invoice deleted", $"You deleted {what}", "Invoice deleted", $"deleted {what}",
                    NotificationLinks.Billing(invoice.ProjectID));
            }

            return Ok(new { message = "Invoice deleted" });
        }

        // POST: /api/billing/payments  = record a payment (can be partial)
        [HttpPost("payments")]
        [RequirePermission("Billing", "Manage")]
        public async Task<IActionResult> RecordPayment([FromBody] RecordPaymentDto dto)
        {
            var ok = await _service.RecordPaymentAsync(dto);
            if (!ok)
                return NotFound(new { message = "Invoice not found" });

            var invoice = await _service.DescribeInvoiceAsync(dto.InvoiceID);
            if (invoice != null)
            {
                var what = $"a payment of {await _company.FormatMoneyAsync(dto.Amount)} on invoice {invoice.InvoiceNumber} ({invoice.ProjectTitle}).";
                await NotifyAsync("Payment recorded", $"You recorded {what}", "Payment received", $"recorded {what}",
                    NotificationLinks.Invoice(invoice.ProjectID, invoice.InvoiceID));
            }

            return Ok(new { message = "Payment recorded" });
        }

        // DELETE: /api/billing/payments/5  = remove a payment
        [HttpDelete("payments/{id}")]
        [RequirePermission("Billing", "Manage")]
        public async Task<IActionResult> DeletePayment(int id)
        {
            var payment = await _service.DescribePaymentAsync(id);
            var ok = await _service.DeletePaymentAsync(id);
            if (!ok)
                return NotFound(new { message = "Payment not found" });

            if (payment != null)
            {
                var invoice = payment.Invoice;
                var what = $"a payment of {await _company.FormatMoneyAsync(payment.Amount)} from invoice {invoice.InvoiceNumber} ({invoice.ProjectTitle}).";
                await NotifyAsync("Payment removed", $"You removed {what}", "Payment removed", $"removed {what}",
                    NotificationLinks.Invoice(invoice.ProjectID, invoice.InvoiceID));
            }

            return Ok(new { message = "Payment deleted" });
        }

        // GET: /api/billing/invoices/5/print  = invoice data for printing
        [HttpGet("invoices/{id}/print")]
        [RequirePermission("Billing", "View")]
        public async Task<IActionResult> Print(int id)
        {
            var data = await _service.GetInvoicePrintAsync(id);
            if (data == null)
                return NotFound(new { message = "Invoice not found" });
            return Ok(data);
        }
    }
}
