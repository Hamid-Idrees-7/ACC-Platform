using System.Text.RegularExpressions;
using Backend.Data;
using Backend.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace Backend.Repositories
{
    public class BillingRepository : IBillingRepository
    {
        private readonly AppDbContext _context;

        public BillingRepository(AppDbContext context)
        {
            _context = context;
        }

        public async Task<List<Invoice>> GetAllInvoicesAsync()
        {
            return await _context.Invoices
                .OrderByDescending(i => i.IssueDate)
                .ThenByDescending(i => i.InvoiceID)
                .ToListAsync();
        }

        public async Task<List<Invoice>> GetInvoicesByProjectAsync(int projectId)
        {
            return await _context.Invoices
                .Where(i => i.ProjectID == projectId)
                .OrderByDescending(i => i.IssueDate)
                .ThenByDescending(i => i.InvoiceID)
                .ToListAsync();
        }

        public async Task<Invoice?> GetInvoiceByIdAsync(int invoiceId)
        {
            return await _context.Invoices.FindAsync(invoiceId);
        }

        public async Task<List<InvoiceItem>> GetItemsByInvoiceIdsAsync(List<int> invoiceIds)
        {
            if (invoiceIds.Count == 0) return new List<InvoiceItem>();
            return await _context.InvoiceItems
                .Where(x => invoiceIds.Contains(x.InvoiceID))
                .ToListAsync();
        }

        public async Task<List<InvoicePayment>> GetPaymentsByInvoiceIdsAsync(List<int> invoiceIds)
        {
            if (invoiceIds.Count == 0) return new List<InvoicePayment>();
            return await _context.InvoicePayments
                .Where(p => invoiceIds.Contains(p.InvoiceID))
                .OrderBy(p => p.PaymentDate)
                .ToListAsync();
        }

        public async Task<int> AddInvoiceAsync(Invoice invoice, List<InvoiceItem> items)
        {
            _context.Invoices.Add(invoice);
            await _context.SaveChangesAsync();   // generates InvoiceID

            foreach (var item in items)
                item.InvoiceID = invoice.InvoiceID;

            if (items.Count > 0)
            {
                _context.InvoiceItems.AddRange(items);
                await _context.SaveChangesAsync();
            }

            return invoice.InvoiceID;
        }

        public async Task UpdateInvoiceAsync(Invoice invoice)
        {
            _context.Invoices.Update(invoice);
            await _context.SaveChangesAsync();
        }

        public async Task ReplaceItemsAsync(int invoiceId, List<InvoiceItem> items)
        {
            var existing = await _context.InvoiceItems
                .Where(x => x.InvoiceID == invoiceId)
                .ToListAsync();
            _context.InvoiceItems.RemoveRange(existing);

            foreach (var item in items)
                item.InvoiceID = invoiceId;
            if (items.Count > 0)
                _context.InvoiceItems.AddRange(items);

            await _context.SaveChangesAsync();
        }

        public async Task<bool> DeleteInvoiceAsync(int invoiceId)
        {
            var invoice = await _context.Invoices.FindAsync(invoiceId);
            if (invoice == null) return false;

            var items = await _context.InvoiceItems.Where(x => x.InvoiceID == invoiceId).ToListAsync();
            var payments = await _context.InvoicePayments.Where(p => p.InvoiceID == invoiceId).ToListAsync();

            _context.InvoiceItems.RemoveRange(items);
            _context.InvoicePayments.RemoveRange(payments);
            _context.Invoices.Remove(invoice);
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task AddPaymentAsync(InvoicePayment payment)
        {
            _context.InvoicePayments.Add(payment);
            await _context.SaveChangesAsync();
        }

        public async Task<InvoicePayment?> GetPaymentByIdAsync(int paymentId)
        {
            return await _context.InvoicePayments.FindAsync(paymentId);
        }

        public async Task<bool> DeletePaymentAsync(int paymentId)
        {
            var payment = await _context.InvoicePayments.FindAsync(paymentId);
            if (payment == null) return false;

            _context.InvoicePayments.Remove(payment);
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<int> MaxInvoiceSeqAsync()
        {
            var numbers = await _context.Invoices
                .Select(i => i.InvoiceNumber)
                .ToListAsync();

            int max = 0;
            foreach (var n in numbers)
            {
                var m = Regex.Match(n ?? string.Empty, @"(\d+)");
                if (m.Success && int.TryParse(m.Value, out var val) && val > max)
                    max = val;
            }
            return max;
        }
    }
}
