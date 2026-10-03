using Backend.Models.Entities;

namespace Backend.Repositories
{
    public interface IBillingRepository
    {
        Task<List<Invoice>> GetAllInvoicesAsync();
        Task<List<Invoice>> GetInvoicesByProjectAsync(int projectId);
        Task<Invoice?> GetInvoiceByIdAsync(int invoiceId);

        // Line items and payments, loaded in bulk for a set of invoices
        Task<List<InvoiceItem>> GetItemsByInvoiceIdsAsync(List<int> invoiceIds);
        Task<List<InvoicePayment>> GetPaymentsByInvoiceIdsAsync(List<int> invoiceIds);

        // Create an invoice together with its line items (returns the new InvoiceID).
        Task<int> AddInvoiceAsync(Invoice invoice, List<InvoiceItem> items);

        // Saves the invoice header and its new lines together: either both are saved or neither.
        Task SaveInvoiceWithItemsAsync(Invoice invoice, List<InvoiceItem> items);

        // Removes the invoice with its items and payments.
        Task<bool> DeleteInvoiceAsync(int invoiceId);

        Task AddPaymentAsync(InvoicePayment payment);
        Task<InvoicePayment?> GetPaymentByIdAsync(int paymentId);
        Task<bool> DeletePaymentAsync(int paymentId);

        // Highest running number used by any invoice (the digits at the end, whatever the
        // prefix), so numbering carries on when the admin changes the invoice prefix.
        Task<int> MaxInvoiceSeqAsync();

        string DatabaseName { get; }
    }
}
