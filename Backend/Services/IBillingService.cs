using Backend.Models.DTOs;

namespace Backend.Services
{
    public interface IBillingService
    {
        // List page: top stats + a card per project.
        Task<BillingOverviewDto> GetOverviewAsync();

        // Detail page for one project (invoices + phases). Null if the project doesn't exist.
        Task<ProjectBillingDto?> GetProjectBillingAsync(int projectId);

        // Create a new invoice (auto number, server-computed amounts). Returns the new InvoiceID.
        Task<int> CreateInvoiceAsync(CreateInvoiceDto dto);

        // Edit an existing invoice's fields + line items. False if not found.
        Task<bool> UpdateInvoiceAsync(int invoiceId, CreateInvoiceDto dto);

        Task<bool> DeleteInvoiceAsync(int invoiceId);

        // Record a partial/full payment. False if the invoice doesn't exist.
        Task<bool> RecordPaymentAsync(RecordPaymentDto dto);

        Task<bool> DeletePaymentAsync(int paymentId);

        // Printable invoice. Null if not found.
        Task<InvoicePrintDto?> GetInvoicePrintAsync(int invoiceId);
    }
}
