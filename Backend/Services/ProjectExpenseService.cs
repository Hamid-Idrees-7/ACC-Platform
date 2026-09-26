using System.Globalization;
using Backend.Models.DTOs;
using Backend.Models.Entities;
using Backend.Repositories;

namespace Backend.Services
{
    // Business rules for project expenses (plot fees, transfer fees, taxes, possession charges...).
    public class ProjectExpenseService : IProjectExpenseService
    {
        // Upper sanity limit for one expense (Rs 10 billion) — catches typing mistakes like extra zeros.
        private const decimal MaxAmount = 10_000_000_000m;

        private readonly IProjectExpenseRepository _repository;
        private readonly IProjectRepository _projectRepository;

        public ProjectExpenseService(
            IProjectExpenseRepository repository,
            IProjectRepository projectRepository)
        {
            _repository = repository;
            _projectRepository = projectRepository;
        }

        public async Task<ProjectExpensesDto?> GetProjectExpensesAsync(int projectId)
        {
            var project = await _projectRepository.GetByIdAsync(projectId);
            if (project == null) return null;

            var phases = await _projectRepository.GetPhasesAsync(projectId);
            var phaseNames = phases.ToDictionary(p => p.PhaseID, p => p.Name);

            var expenses = await _repository.GetByProjectAsync(projectId);
            var links = await _repository.GetInvoiceLinksAsync(expenses.Select(e => e.ExpenseID).ToList());

            var items = expenses.Select(e => ToDto(e, phaseNames, links)).ToList();

            var company = items.Where(i => !i.IsRecoverable).ToList();
            var recoverable = items.Where(i => i.IsRecoverable).ToList();
            decimal recoverableTotal = recoverable.Sum(i => i.Amount);
            decimal recoverableInvoiced = recoverable.Where(i => i.IsInvoiced).Sum(i => i.Amount);

            return new ProjectExpensesDto
            {
                ProjectID = project.ProjectID,
                ProjectTitle = project.Title,
                CompanyTotal = company.Sum(i => i.Amount),
                RecoverableTotal = recoverableTotal,
                RecoverableInvoiced = recoverableInvoiced,
                RecoverablePending = recoverableTotal - recoverableInvoiced,
                Items = items,
                ByCategory = company
                    .GroupBy(i => i.Category)
                    .Select(g => new SliceDto { Label = g.Key, Value = g.Sum(i => i.Amount) })
                    .OrderByDescending(s => s.Value)
                    .ToList(),
                Categories = ExpenseCategories.All.ToList(),
                Phases = phases.Select(p => new PhaseOptionDto { PhaseID = p.PhaseID, Name = p.Name }).ToList()
            };
        }

        public async Task<ProjectExpenseDto?> GetByIdAsync(int id)
        {
            var expense = await _repository.GetByIdAsync(id);
            if (expense == null) return null;

            var phases = await _projectRepository.GetPhasesAsync(expense.ProjectID);
            var links = await _repository.GetInvoiceLinksAsync(new List<int> { id });
            return ToDto(expense, phases.ToDictionary(p => p.PhaseID, p => p.Name), links);
        }

        public async Task<ExpenseSaveResult> CreateAsync(int projectId, SaveProjectExpenseDto dto, int userId)
        {
            var project = await _projectRepository.GetByIdAsync(projectId);
            if (project == null) return new ExpenseSaveResult(null, NotFound: true);

            var (clean, error) = await ValidateAsync(projectId, dto);
            if (error != null) return new ExpenseSaveResult(null, error);

            var expense = new ProjectExpense
            {
                ProjectID = projectId,
                PhaseID = clean!.PhaseID,
                Category = clean.Category,
                Description = clean.Description,
                Amount = clean.Amount,
                ExpenseDate = clean.ExpenseDate,
                PaidTo = clean.PaidTo,
                Reference = clean.Reference,
                IsRecoverable = clean.IsRecoverable,
                CreatedByUserID = userId,
                CreatedAt = DateTime.Now,
                UpdatedAt = DateTime.Now
            };

            await _repository.AddAsync(expense);
            return new ExpenseSaveResult(await GetByIdAsync(expense.ExpenseID));
        }

        public async Task<ExpenseSaveResult> UpdateAsync(int id, SaveProjectExpenseDto dto)
        {
            var expense = await _repository.GetByIdAsync(id);
            if (expense == null) return new ExpenseSaveResult(null, NotFound: true);

            var (clean, error) = await ValidateAsync(expense.ProjectID, dto);
            if (error != null) return new ExpenseSaveResult(null, error);

            // A billed expense is locked to the invoice line that bills it: its amount and its
            // recoverable status must stay as billed, or the invoice and the cost would disagree.
            var links = await _repository.GetInvoiceLinksAsync(new List<int> { id });
            if (links.TryGetValue(id, out var link) &&
                (clean!.Amount != expense.Amount || clean.IsRecoverable != expense.IsRecoverable))
            {
                return new ExpenseSaveResult(null,
                    $"This expense is billed on invoice {link.InvoiceNumber}. Remove it from that invoice first to change its amount or make it a company cost.");
            }

            expense.PhaseID = clean!.PhaseID;
            expense.Category = clean.Category;
            expense.Description = clean.Description;
            expense.Amount = clean.Amount;
            expense.ExpenseDate = clean.ExpenseDate;
            expense.PaidTo = clean.PaidTo;
            expense.Reference = clean.Reference;
            expense.IsRecoverable = clean.IsRecoverable;
            expense.UpdatedAt = DateTime.Now;

            await _repository.UpdateAsync(expense);
            return new ExpenseSaveResult(await GetByIdAsync(id));
        }

        public async Task<string?> GetDeleteBlockerAsync(int id)
        {
            var links = await _repository.GetInvoiceLinksAsync(new List<int> { id });
            if (links.TryGetValue(id, out var link))
                return $"This expense is billed on invoice {link.InvoiceNumber}. Remove it from that invoice before deleting it.";
            return null;
        }

        public async Task<bool> DeleteAsync(int id)
        {
            // Checked again here so an approval accepted later can never remove a billed expense.
            if (await GetDeleteBlockerAsync(id) != null) return false;
            return await _repository.DeleteAsync(id);
        }

        public async Task<string> DescribeAsync(ProjectExpenseDto expense)
        {
            var project = await _projectRepository.GetByIdAsync(expense.ProjectID);
            var label = $"{expense.Description} ({FormatRs(expense.Amount)}) on {project?.Title ?? "a project"}";
            // PendingAction.TargetName holds up to 150 characters.
            return label.Length <= 150 ? label : label[..147] + "...";
        }

        public static string FormatRs(decimal amount) =>
            "Rs " + amount.ToString("#,0.##", CultureInfo.InvariantCulture);

        // Validates and cleans the incoming values. Returns the cleaned copy or an error message.
        private async Task<(SaveProjectExpenseDto? Clean, string? Error)> ValidateAsync(int projectId, SaveProjectExpenseDto dto)
        {
            var category = ExpenseCategories.Normalize(dto.Category);
            if (category == null)
                return (null, "Choose a category from the list.");

            var description = dto.Description?.Trim() ?? "";
            if (description.Length < 2)
                return (null, category == ExpenseCategories.Other
                    ? "Describe what this expense was for."
                    : "Add a short description.");
            if (description.Length > 200)
                return (null, "Description can be at most 200 characters.");

            if (dto.Amount <= 0)
                return (null, "Amount must be greater than zero.");
            if (dto.Amount > MaxAmount)
                return (null, "Amount is too large. Please check the number.");
            var amount = Math.Round(dto.Amount, 2);

            if (dto.ExpenseDate == default)
                return (null, "Pick the date the expense was paid.");
            var date = dto.ExpenseDate.Date;
            if (date > DateTime.Now.Date)
                return (null, "Expense date can't be in the future.");
            if (date.Year < 2000)
                return (null, "Expense date is not valid.");

            if (dto.PhaseID.HasValue)
            {
                var phase = await _projectRepository.GetPhaseByIdAsync(dto.PhaseID.Value);
                if (phase == null || phase.ProjectID != projectId)
                    return (null, "Pick a phase from this project.");
            }

            var paidTo = string.IsNullOrWhiteSpace(dto.PaidTo) ? null : dto.PaidTo.Trim();
            if (paidTo is { Length: > 100 })
                return (null, "Paid to can be at most 100 characters.");

            var reference = string.IsNullOrWhiteSpace(dto.Reference) ? null : dto.Reference.Trim();
            if (reference is { Length: > 60 })
                return (null, "Reference can be at most 60 characters.");

            return (new SaveProjectExpenseDto
            {
                Category = category,
                Description = description,
                Amount = amount,
                ExpenseDate = date,
                PhaseID = dto.PhaseID,
                PaidTo = paidTo,
                Reference = reference,
                IsRecoverable = dto.IsRecoverable
            }, null);
        }

        private static ProjectExpenseDto ToDto(
            ProjectExpense e,
            Dictionary<int, string> phaseNames,
            Dictionary<int, ExpenseInvoiceLink> links)
        {
            links.TryGetValue(e.ExpenseID, out var link);
            return new ProjectExpenseDto
            {
                ExpenseID = e.ExpenseID,
                ProjectID = e.ProjectID,
                PhaseID = e.PhaseID,
                PhaseName = e.PhaseID.HasValue && phaseNames.TryGetValue(e.PhaseID.Value, out var name) ? name : "General",
                Category = e.Category,
                Description = e.Description,
                Amount = e.Amount,
                ExpenseDate = e.ExpenseDate,
                PaidTo = e.PaidTo,
                Reference = e.Reference,
                IsRecoverable = e.IsRecoverable,
                InvoiceID = link?.InvoiceID,
                InvoiceNumber = link?.InvoiceNumber,
                CreatedAt = e.CreatedAt,
                UpdatedAt = e.UpdatedAt
            };
        }
    }
}
