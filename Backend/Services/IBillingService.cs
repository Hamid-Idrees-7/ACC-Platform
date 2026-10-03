using Backend.Models.DTOs;

namespace Backend.Services
{
    public interface IBillingService
    {
        // List page: top stats and a card per project.
        Task<BillingOverviewDto> GetOverviewAsync();

        // Detail page for one project (invoices and phases). Null if the project doesn't exist.
        Task<ProjectBillingDto?> GetProjectBillingAsync(int projectId);

        // Creates an invoice (automatic number, amounts worked out on the server).
        // Returns the new InvoiceID, or an error message if a line is not valid.
        Task<(int? InvoiceId, string? Error)> CreateInvoiceAsync(CreateInvoiceDto dto);

        // Edits an invoice's fields and line items.
        // Found is false if the invoice doesn't exist; Error is set if a line is not valid.
        Task<(bool Found, string? Error)> UpdateInvoiceAsync(int invoiceId, CreateInvoiceDto dto);

        // Error when the invoice has payments (they must be removed first).
        Task<(bool Found, string? Error)> DeleteInvoiceAsync(int invoiceId);

        // Records a part or full payment. False if the invoice doesn't exist.
        Task<(bool Found, string? Error)> RecordPaymentAsync(RecordPaymentDto dto);

        Task<bool> DeletePaymentAsync(int paymentId);

        // Printable invoice. Null if not found.
        Task<InvoicePrintDto?> GetInvoicePrintAsync(int invoiceId);

        Task<InvoiceSummary?> DescribeInvoiceAsync(int invoiceId);

        Task<PaymentSummary?> DescribePaymentAsync(int paymentId);
    }

    public record InvoiceSummary(int InvoiceID, string InvoiceNumber, int ProjectID, string ProjectTitle, decimal Total);

    public record PaymentSummary(InvoiceSummary Invoice, decimal Amount);
}
