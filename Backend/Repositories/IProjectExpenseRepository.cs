using Backend.Models.Entities;

namespace Backend.Repositories
{
    // Where a billed expense was invoiced (one expense can only be billed once).
    public record ExpenseInvoiceLink(int ExpenseID, int InvoiceID, string InvoiceNumber);

    public interface IProjectExpenseRepository
    {
        Task<List<ProjectExpense>> GetAllAsync();
        Task<List<ProjectExpense>> GetByProjectAsync(int projectId);
        Task<List<ProjectExpense>> GetByIdsAsync(List<int> ids);
        Task<ProjectExpense?> GetByIdAsync(int id);
        Task<ProjectExpense> AddAsync(ProjectExpense expense);
        Task UpdateAsync(ProjectExpense expense);
        Task<bool> DeleteAsync(int id);
        Task<bool> AnyForProjectAsync(int projectId);

        // Invoice links for the given expenses, keyed by ExpenseID.
        Task<Dictionary<int, ExpenseInvoiceLink>> GetInvoiceLinksAsync(List<int> expenseIds);
    }
}
