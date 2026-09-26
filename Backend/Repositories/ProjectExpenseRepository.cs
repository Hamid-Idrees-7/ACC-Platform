using Backend.Data;
using Backend.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace Backend.Repositories
{
    public class ProjectExpenseRepository : IProjectExpenseRepository
    {
        private readonly AppDbContext _context;

        public ProjectExpenseRepository(AppDbContext context)
        {
            _context = context;
        }

        public async Task<List<ProjectExpense>> GetAllAsync()
        {
            return await _context.ProjectExpenses.ToListAsync();
        }

        // Newest first (by the date it was paid, then by entry order).
        public async Task<List<ProjectExpense>> GetByProjectAsync(int projectId)
        {
            return await _context.ProjectExpenses
                .Where(e => e.ProjectID == projectId)
                .OrderByDescending(e => e.ExpenseDate)
                .ThenByDescending(e => e.ExpenseID)
                .ToListAsync();
        }

        public async Task<List<ProjectExpense>> GetByIdsAsync(List<int> ids)
        {
            if (ids.Count == 0) return new List<ProjectExpense>();
            return await _context.ProjectExpenses
                .Where(e => ids.Contains(e.ExpenseID))
                .ToListAsync();
        }

        public async Task<ProjectExpense?> GetByIdAsync(int id)
        {
            return await _context.ProjectExpenses.FindAsync(id);
        }

        public async Task<ProjectExpense> AddAsync(ProjectExpense expense)
        {
            _context.ProjectExpenses.Add(expense);
            await _context.SaveChangesAsync();
            return expense;
        }

        public async Task UpdateAsync(ProjectExpense expense)
        {
            _context.ProjectExpenses.Update(expense);
            await _context.SaveChangesAsync();
        }

        public async Task<bool> DeleteAsync(int id)
        {
            var expense = await _context.ProjectExpenses.FindAsync(id);
            if (expense == null) return false;

            _context.ProjectExpenses.Remove(expense);
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<bool> AnyForProjectAsync(int projectId)
        {
            return await _context.ProjectExpenses.AnyAsync(e => e.ProjectID == projectId);
        }

        public async Task<Dictionary<int, ExpenseInvoiceLink>> GetInvoiceLinksAsync(List<int> expenseIds)
        {
            if (expenseIds.Count == 0) return new Dictionary<int, ExpenseInvoiceLink>();

            var links = await (
                from item in _context.InvoiceItems
                join invoice in _context.Invoices on item.InvoiceID equals invoice.InvoiceID
                where item.ExpenseID != null && expenseIds.Contains(item.ExpenseID.Value)
                select new { ExpenseID = item.ExpenseID!.Value, invoice.InvoiceID, invoice.InvoiceNumber }
            ).ToListAsync();

            // The unique index allows one line per expense; GroupBy just keeps this safe.
            return links
                .GroupBy(l => l.ExpenseID)
                .ToDictionary(g => g.Key, g => new ExpenseInvoiceLink(g.Key, g.First().InvoiceID, g.First().InvoiceNumber));
        }
    }
}
