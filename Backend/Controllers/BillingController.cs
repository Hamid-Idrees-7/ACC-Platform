using Backend.Auth;
using Backend.Models.DTOs;
using Backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Backend.Controllers
{
    // API endpoints for Billing & Invoices. Base route: /api/billing
    // Reading needs View; anything that changes data needs "Manage".
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class BillingController : ControllerBase
    {
        private readonly IBillingService _service;

        public BillingController(IBillingService service)
        {
            _service = service;
        }

        // GET /api/billing — overview stats + a card per project
        [HttpGet]
        [RequirePermission("Billing", "View")]
        public async Task<IActionResult> GetOverview()
        {
            return Ok(await _service.GetOverviewAsync());
        }

        // GET /api/billing/project/5 — one project's invoices + phase options
        [HttpGet("project/{projectId}")]
        [RequirePermission("Billing", "View")]
        public async Task<IActionResult> GetProject(int projectId)
        {
            var data = await _service.GetProjectBillingAsync(projectId);
            if (data == null)
                return NotFound(new { message = "Project not found" });
            return Ok(data);
        }

        // POST /api/billing/invoices — create an invoice
        [HttpPost("invoices")]
        [RequirePermission("Billing", "Manage")]
        public async Task<IActionResult> CreateInvoice([FromBody] CreateInvoiceDto dto)
        {
            var id = await _service.CreateInvoiceAsync(dto);
            return Ok(new { invoiceId = id });
        }

        // PUT /api/billing/invoices/5 — edit an invoice
        [HttpPut("invoices/{id}")]
        [RequirePermission("Billing", "Manage")]
        public async Task<IActionResult> UpdateInvoice(int id, [FromBody] CreateInvoiceDto dto)
        {
            var ok = await _service.UpdateInvoiceAsync(id, dto);
            if (!ok)
                return NotFound(new { message = "Invoice not found" });
            return Ok(new { message = "Invoice updated" });
        }

        // DELETE /api/billing/invoices/5 — delete an invoice (with its items + payments)
        [HttpDelete("invoices/{id}")]
        [RequirePermission("Billing", "Manage")]
        public async Task<IActionResult> DeleteInvoice(int id)
        {
            var ok = await _service.DeleteInvoiceAsync(id);
            if (!ok)
                return NotFound(new { message = "Invoice not found" });
            return Ok(new { message = "Invoice deleted" });
        }

        // POST /api/billing/payments — record a (partial) payment
        [HttpPost("payments")]
        [RequirePermission("Billing", "Manage")]
        public async Task<IActionResult> RecordPayment([FromBody] RecordPaymentDto dto)
        {
            var ok = await _service.RecordPaymentAsync(dto);
            if (!ok)
                return NotFound(new { message = "Invoice not found" });
            return Ok(new { message = "Payment recorded" });
        }

        // DELETE /api/billing/payments/5 — remove a payment
        [HttpDelete("payments/{id}")]
        [RequirePermission("Billing", "Manage")]
        public async Task<IActionResult> DeletePayment(int id)
        {
            var ok = await _service.DeletePaymentAsync(id);
            if (!ok)
                return NotFound(new { message = "Payment not found" });
            return Ok(new { message = "Payment deleted" });
        }

        // GET /api/billing/invoices/5/print — printable invoice payload
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
