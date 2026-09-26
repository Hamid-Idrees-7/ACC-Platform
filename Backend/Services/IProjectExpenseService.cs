using Backend.Models.DTOs;

namespace Backend.Services
{
    // Outcome of an add/edit: the saved expense, or why it was refused.
    // NotFound = the project or expense does not exist; Error = a validation message.
    public record ExpenseSaveResult(ProjectExpenseDto? Expense, string? Error = null, bool NotFound = false);

    public interface IProjectExpenseService
    {
        // All expenses of a project with totals. Null if the project doesn't exist.
        Task<ProjectExpensesDto?> GetProjectExpensesAsync(int projectId);

        Task<ProjectExpenseDto?> GetByIdAsync(int id);

        Task<ExpenseSaveResult> CreateAsync(int projectId, SaveProjectExpenseDto dto, int userId);

        Task<ExpenseSaveResult> UpdateAsync(int id, SaveProjectExpenseDto dto);

        // Null when the expense may be deleted; otherwise the reason it can't be.
        Task<string?> GetDeleteBlockerAsync(int id);

        Task<bool> DeleteAsync(int id);

        // Short label used in notifications and approval requests,
        // eg Transfer fee (Rs 25,000) on Model Town House
        Task<string> DescribeAsync(ProjectExpenseDto expense);
    }
}
