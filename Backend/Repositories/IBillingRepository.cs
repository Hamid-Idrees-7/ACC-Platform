using Backend.Models.Entities;

namespace Backend.Repositories
{
    public interface IBillingRepository
    {
        // Invoices
        Task<List<Invoice>> GetAllInvoicesAsync();
        Task<List<Invoice>> GetInvoicesByProjectAsync(int projectId);
        Task<Invoice?> GetInvoiceByIdAsync(int invoiceId);

        // Line items + payments (loaded in bulk for a set of invoices)
        Task<List<InvoiceItem>> GetItemsByInvoiceIdsAsync(List<int> invoiceIds);
        Task<List<InvoicePayment>> GetPaymentsByInvoiceIdsAsync(List<int> invoiceIds);

        // Create an invoice together with its line items (returns the new InvoiceID).
        Task<int> AddInvoiceAsync(Invoice invoice, List<InvoiceItem> items);

        Task UpdateInvoiceAsync(Invoice invoice);
        // Swap all line items on an invoice for a new set.
        Task ReplaceItemsAsync(int invoiceId, List<InvoiceItem> items);
        // Removes the invoice with its items and payments.
        Task<bool> DeleteInvoiceAsync(int invoiceId);

        // Payments
        Task AddPaymentAsync(InvoicePayment payment);
        Task<InvoicePayment?> GetPaymentByIdAsync(int paymentId);
        Task<bool> DeletePaymentAsync(int paymentId);

        // Highest numeric suffix currently used across all invoice numbers (for INV-0001 auto-numbering).
        Task<int> MaxInvoiceSeqAsync();
    }
}
