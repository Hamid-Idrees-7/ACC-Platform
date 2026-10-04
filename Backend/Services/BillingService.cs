using Backend.Models.DTOs;
using Backend.Models.Entities;
using Backend.Repositories;

namespace Backend.Services
{
    public class BillingService : IBillingService
    {
        private readonly IProjectRepository _projectRepository;
        private readonly IClientRepository _clientRepository;
        private readonly IBillingRepository _billingRepository;
        private readonly IProjectExpenseRepository _expenseRepository;
        private readonly ICompanySettingsService _companyService;

        public BillingService(
            IProjectRepository projectRepository,
            IClientRepository clientRepository,
            IBillingRepository billingRepository,
            IProjectExpenseRepository expenseRepository,
            ICompanySettingsService companyService)
        {
            _projectRepository = projectRepository;
            _clientRepository = clientRepository;
            _billingRepository = billingRepository;
            _expenseRepository = expenseRepository;
            _companyService = companyService;
        }

        // Overview (list page)
        public async Task<BillingOverviewDto> GetOverviewAsync()
        {
            var projects = await _projectRepository.GetAllAsync();
            var clients = (await _clientRepository.GetAllAsync()).ToList();
            var clientNames = clients.ToDictionary(c => c.ClientID, c => c.FullName);

            var invoices = await _billingRepository.GetAllInvoicesAsync();
            var invoiceIds = invoices.Select(i => i.InvoiceID).ToList();
            var items = await _billingRepository.GetItemsByInvoiceIdsAsync(invoiceIds);
            var payments = await _billingRepository.GetPaymentsByInvoiceIdsAsync(invoiceIds);

            var itemsByInvoice = items.GroupBy(x => x.InvoiceID).ToDictionary(g => g.Key, g => g.ToList());
            var paymentsByInvoice = payments.GroupBy(p => p.InvoiceID).ToDictionary(g => g.Key, g => g.ToList());

            var overview = new BillingOverviewDto
            {
                TotalProjects = projects.Count,
                TotalInvoices = invoices.Count
            };

            var cards = new List<BillingProjectCardDto>();

            foreach (var p in projects)
            {
                var projInvoices = invoices.Where(i => i.ProjectID == p.ProjectID).ToList();

                decimal billed = 0m, received = 0m, reimbursed = 0m;
                int paidCount = 0, overdueCount = 0;

                foreach (var inv in projInvoices)
                {
                    decimal subtotal = itemsByInvoice.GetValueOrDefault(inv.InvoiceID)?.Sum(x => x.Amount) ?? 0m;
                    decimal total = subtotal + inv.TaxAmount;
                    decimal paid = paymentsByInvoice.GetValueOrDefault(inv.InvoiceID)?.Sum(x => x.Amount) ?? 0m;
                    decimal due = total - paid;
                    string status = DeriveStatus(total, paid, due, inv.DueDate);

                    billed += total;
                    received += paid;
                    reimbursed += itemsByInvoice.GetValueOrDefault(inv.InvoiceID)?.Where(x => x.ExpenseID.HasValue).Sum(x => x.Amount) ?? 0m;

                    if (status == "Paid") { paidCount++; overview.PaidCount++; overview.PaidAmount += total; }
                    else
                    {
                        overview.UnpaidCount++;
                        overview.UnpaidAmount += due;
                    }
                    if (status == "Overdue") { overdueCount++; overview.OverdueCount++; overview.OverdueAmount += due; }
                }

                cards.Add(new BillingProjectCardDto
                {
                    ProjectID = p.ProjectID,
                    Title = p.Title,
                    ClientName = clientNames.GetValueOrDefault(p.ClientID, "—"),
                    Location = p.Location,
                    ProjectType = p.ProjectType,
                    Status = p.Status,
                    Budget = p.Budget,
                    InvoiceCount = projInvoices.Count,
                    PaidCount = paidCount,
                    OverdueCount = overdueCount,
                    Billed = billed,
                    ContractBilled = billed - reimbursed,
                    Received = received,
                    Outstanding = billed - received
                });
            }

            // Projects that have invoices first (most billing activity), then the rest.
            overview.Projects = cards
                .OrderByDescending(c => c.InvoiceCount > 0)
                .ThenByDescending(c => c.Outstanding)
                .ThenBy(c => c.Title)
                .ToList();

            return overview;
        }

        // Project detail page
        public async Task<ProjectBillingDto?> GetProjectBillingAsync(int projectId)
        {
            var project = await _projectRepository.GetByIdAsync(projectId);
            if (project == null) return null;

            var client = await _clientRepository.GetByIdAsync(project.ClientID);
            var phases = await _projectRepository.GetPhasesAsync(projectId);

            var invoices = await _billingRepository.GetInvoicesByProjectAsync(projectId);
            var invoiceIds = invoices.Select(i => i.InvoiceID).ToList();
            var items = await _billingRepository.GetItemsByInvoiceIdsAsync(invoiceIds);
            var payments = await _billingRepository.GetPaymentsByInvoiceIdsAsync(invoiceIds);

            var itemsByInvoice = items.GroupBy(x => x.InvoiceID).ToDictionary(g => g.Key, g => g.ToList());
            var paymentsByInvoice = payments.GroupBy(p => p.InvoiceID).ToDictionary(g => g.Key, g => g.ToList());

            var invoiceDtos = invoices
                .Select(inv => BuildInvoiceDto(inv,
                    itemsByInvoice.GetValueOrDefault(inv.InvoiceID) ?? new List<InvoiceItem>(),
                    paymentsByInvoice.GetValueOrDefault(inv.InvoiceID) ?? new List<InvoicePayment>()))
                .ToList();

            decimal totalInvoiced = invoiceDtos.Sum(i => i.Total);
            decimal received = invoiceDtos.Sum(i => i.Paid);

            // Expense lines are reimbursements (outside the agreed price). Everything else,
            // tax included, is billed against the budget.
            decimal reimbursementInvoiced = items.Where(x => x.ExpenseID.HasValue).Sum(x => x.Amount);
            decimal contractInvoiced = totalInvoiced - reimbursementInvoiced;

            // Recoverable expenses that no invoice bills yet.
            var expenses = await _expenseRepository.GetByProjectAsync(projectId);
            var recoverable = expenses.Where(e => e.IsRecoverable).ToList();
            var links = await _expenseRepository.GetInvoiceLinksAsync(recoverable.Select(e => e.ExpenseID).ToList());
            var pending = recoverable
                .Where(e => !links.ContainsKey(e.ExpenseID))
                .OrderBy(e => e.ExpenseDate)
                .Select(e => new PendingReimbursementDto
                {
                    ExpenseID = e.ExpenseID,
                    Category = e.Category,
                    Description = e.Description,
                    Amount = e.Amount,
                    ExpenseDate = e.ExpenseDate,
                    PhaseID = e.PhaseID
                })
                .ToList();

            return new ProjectBillingDto
            {
                ProjectID = project.ProjectID,
                Title = project.Title,
                ClientName = client?.FullName ?? "—",
                ClientPhone = client?.Phone,
                Location = project.Location,
                ProjectType = project.ProjectType,
                Status = project.Status,
                Budget = project.Budget,
                TotalInvoiced = totalInvoiced,
                Received = received,
                Outstanding = totalInvoiced - received,
                PercentInvoiced = project.Budget > 0 ? Math.Round(contractInvoiced / project.Budget * 100m, 1) : 0m,
                ContractInvoiced = contractInvoiced,
                ReimbursementInvoiced = reimbursementInvoiced,
                PendingReimbursements = pending,
                Invoices = invoiceDtos,
                Phases = phases.Select(ph => new PhaseOptionDto { PhaseID = ph.PhaseID, Name = ph.Name }).ToList()
            };
        }

        private const decimal MaxAmount = 10_000_000_000_000m;

        // Tax, dates and notes shared by create and edit. Null when they are fine.
        private static string? CheckHeader(CreateInvoiceDto dto, DateTime issueDate)
        {
            if (dto.TaxAmount < 0) return "Tax can't be negative.";
            if (dto.TaxAmount > MaxAmount) return "The tax is too large.";
            if (issueDate.Year < 2000 || issueDate.Year > 2100) return "Enter a valid issue date.";
            if (dto.DueDate != null && dto.DueDate.Value.Date < issueDate.Date) return "The due date can't be before the issue date.";
            if (dto.Notes?.Trim().Length > 255) return "Notes can be at most 255 characters.";
            return null;
        }

        public async Task<(int? InvoiceId, string? Error)> CreateInvoiceAsync(CreateInvoiceDto dto)
        {
            var project = await _projectRepository.GetByIdAsync(dto.ProjectID);
            if (project == null) return (null, "Project not found.");

            var issueDate = dto.IssueDate == default ? AppTime.Now : dto.IssueDate;
            var headerError = CheckHeader(dto, issueDate);
            if (headerError != null) return (null, headerError);

            var (items, error) = await BuildItemsAsync(dto.ProjectID, null, dto.Items);
            if (error != null) return (null, error);

            var invoice = new Invoice
            {
                // The prefix comes from Settings > Company
                InvoiceNumber = await _companyService.NewInvoiceNumberAsync(),
                ProjectID = dto.ProjectID,
                IssueDate = issueDate,
                DueDate = dto.DueDate,
                TaxAmount = Math.Round(dto.TaxAmount, 2),
                Notes = string.IsNullOrWhiteSpace(dto.Notes) ? null : dto.Notes.Trim(),
                CreatedAt = AppTime.Now
            };

            return (await _billingRepository.AddInvoiceAsync(invoice, items!), null);
        }

        public async Task<(bool Found, string? Error)> UpdateInvoiceAsync(int invoiceId, CreateInvoiceDto dto)
        {
            using var _ = await Locks.ForInvoiceAsync(_billingRepository.DatabaseName, invoiceId);

            var invoice = await _billingRepository.GetInvoiceByIdAsync(invoiceId);
            if (invoice == null) return (false, null);

            var issueDate = dto.IssueDate == default ? invoice.IssueDate : dto.IssueDate;
            var headerError = CheckHeader(dto, issueDate);
            if (headerError != null) return (true, headerError);

            // Lines are checked against the invoice's own project (it never changes).
            var (items, error) = await BuildItemsAsync(invoice.ProjectID, invoiceId, dto.Items);
            if (error != null) return (true, error);

            // The new total can't be less than the money already received on it.
            var tax = Math.Round(dto.TaxAmount, 2);
            var paid = (await _billingRepository.GetPaymentsByInvoiceIdsAsync(new List<int> { invoiceId })).Sum(p => p.Amount);
            var newTotal = items!.Sum(i => i.Amount) + tax;
            if (newTotal < paid)
                return (true, $"This invoice already has {await _companyService.FormatMoneyAsync(paid)} received, so its total can't go below that. Remove a payment first.");

            // InvoiceNumber and ProjectID stay fixed once created.
            invoice.IssueDate = issueDate;
            invoice.DueDate = dto.DueDate;
            invoice.TaxAmount = tax;
            invoice.Notes = string.IsNullOrWhiteSpace(dto.Notes) ? null : dto.Notes.Trim();

            await _billingRepository.SaveInvoiceWithItemsAsync(invoice, items!);
            return (true, null);
        }

        public async Task<(bool Found, string? Error)> DeleteInvoiceAsync(int invoiceId)
        {
            using var _ = await Locks.ForInvoiceAsync(_billingRepository.DatabaseName, invoiceId);

            var invoice = await _billingRepository.GetInvoiceByIdAsync(invoiceId);
            if (invoice == null) return (false, null);

            // Money received is part of the record: payments are removed one by one first.
            var payments = await _billingRepository.GetPaymentsByInvoiceIdsAsync(new List<int> { invoiceId });
            if (payments.Count > 0)
                return (true, $"Invoice {invoice.InvoiceNumber} has payments recorded, so it can't be deleted. Remove those payments first.");

            return (await _billingRepository.DeleteInvoiceAsync(invoiceId), null);
        }

        public async Task<(bool Found, string? Error)> RecordPaymentAsync(RecordPaymentDto dto)
        {
            // One payment at a time per invoice, so two can't both fit into the same balance.
            using var _ = await Locks.ForInvoiceAsync(_billingRepository.DatabaseName, dto.InvoiceID);

            var invoice = await _billingRepository.GetInvoiceByIdAsync(dto.InvoiceID);
            if (invoice == null) return (false, null);

            var amount = Math.Round(dto.Amount, 2);
            if (amount <= 0) return (true, "Enter an amount greater than zero.");

            var method = string.IsNullOrWhiteSpace(dto.Method) ? "Cash" : dto.Method.Trim();
            if (method.Length > 30) return (true, "The payment method can be at most 30 characters.");
            var reference = string.IsNullOrWhiteSpace(dto.Reference) ? null : dto.Reference.Trim();
            if (reference?.Length > 255) return (true, "The reference can be at most 255 characters.");

            var paymentDate = dto.PaymentDate == default ? AppTime.Now : dto.PaymentDate;
            if (paymentDate.Year < 2000 || paymentDate.Date > AppTime.Now.Date.AddDays(1))
                return (true, "Enter a valid payment date (not in the future).");

            var ids = new List<int> { dto.InvoiceID };
            var items = await _billingRepository.GetItemsByInvoiceIdsAsync(ids);
            var paid = (await _billingRepository.GetPaymentsByInvoiceIdsAsync(ids)).Sum(p => p.Amount);
            var due = items.Sum(i => i.Amount) + invoice.TaxAmount - paid;
            if (due <= 0) return (true, "This invoice is already fully paid.");
            if (amount > due)
                return (true, $"The payment is more than the amount due ({await _companyService.FormatMoneyAsync(due)}).");

            await _billingRepository.AddPaymentAsync(new InvoicePayment
            {
                InvoiceID = dto.InvoiceID,
                Amount = amount,
                PaymentDate = paymentDate,
                Method = method,
                Reference = reference,
                CreatedAt = AppTime.Now
            });
            return (true, null);
        }

        public async Task<bool> DeletePaymentAsync(int paymentId)
        {
            return await _billingRepository.DeletePaymentAsync(paymentId);
        }

        public async Task<InvoicePrintDto?> GetInvoicePrintAsync(int invoiceId)
        {
            var invoice = await _billingRepository.GetInvoiceByIdAsync(invoiceId);
            if (invoice == null) return null;

            var ids = new List<int> { invoiceId };
            var items = await _billingRepository.GetItemsByInvoiceIdsAsync(ids);
            var payments = await _billingRepository.GetPaymentsByInvoiceIdsAsync(ids);
            var invoiceDto = BuildInvoiceDto(invoice, items, payments);

            var project = await _projectRepository.GetByIdAsync(invoice.ProjectID);
            Client? client = project != null ? await _clientRepository.GetByIdAsync(project.ClientID) : null;

            return new InvoicePrintDto
            {
                Company = await _companyService.GetBrandAsync(),
                InvoiceID = invoice.InvoiceID,
                InvoiceNumber = invoice.InvoiceNumber,
                Status = invoiceDto.Status,
                IssueDate = invoice.IssueDate,
                DueDate = invoice.DueDate,
                ClientName = client?.FullName ?? "—",
                ClientPhone = client?.Phone,
                ClientAddress = client?.Address,
                ProjectTitle = project?.Title ?? "—",
                ProjectLocation = project?.Location ?? "",
                Items = invoiceDto.Items,
                Subtotal = invoiceDto.Subtotal,
                TaxAmount = invoiceDto.TaxAmount,
                Total = invoiceDto.Total,
                Paid = invoiceDto.Paid,
                Remaining = invoiceDto.Due,
                Notes = invoice.Notes,
                Payments = invoiceDto.Payments,
                GeneratedAt = AppTime.Now
            };
        }

        public async Task<InvoiceSummary?> DescribeInvoiceAsync(int invoiceId)
        {
            var invoice = await _billingRepository.GetInvoiceByIdAsync(invoiceId);
            if (invoice == null) return null;

            var ids = new List<int> { invoiceId };
            var subtotal = (await _billingRepository.GetItemsByInvoiceIdsAsync(ids)).Sum(i => i.Amount);
            var project = await _projectRepository.GetByIdAsync(invoice.ProjectID);
            return new InvoiceSummary(invoice.InvoiceID, invoice.InvoiceNumber, invoice.ProjectID,
                project?.Title ?? "a project", subtotal + invoice.TaxAmount);
        }

        public async Task<PaymentSummary?> DescribePaymentAsync(int paymentId)
        {
            var payment = await _billingRepository.GetPaymentByIdAsync(paymentId);
            if (payment == null) return null;

            var invoice = await DescribeInvoiceAsync(payment.InvoiceID);
            return invoice == null ? null : new PaymentSummary(invoice, payment.Amount);
        }

        // Helpers

        // Builds the line items from the input; Amount = Quantity x Rate.
        // A line that bills an expense is checked (same project, recoverable, not billed on
        // another invoice, not repeated) and fixed to quantity 1 at the expense amount.
        // currentInvoiceId is the invoice being edited (null when creating a new one).
        private async Task<(List<InvoiceItem>? Items, string? Error)> BuildItemsAsync(
            int projectId, int? currentInvoiceId, List<CreateInvoiceItemDto>? input)
        {
            var lines = (input ?? new List<CreateInvoiceItemDto>())
                .Where(i => i.ExpenseID.HasValue || !string.IsNullOrWhiteSpace(i.Description) || i.Rate != 0)
                .ToList();

            var expenseIds = lines.Where(i => i.ExpenseID.HasValue).Select(i => i.ExpenseID!.Value).ToList();
            if (expenseIds.Count != expenseIds.Distinct().Count())
                return (null, "The same expense is added twice on this invoice.");

            var expenses = (await _expenseRepository.GetByIdsAsync(expenseIds)).ToDictionary(e => e.ExpenseID);
            var links = await _expenseRepository.GetInvoiceLinksAsync(expenseIds);
            var phaseIds = (await _projectRepository.GetPhasesAsync(projectId)).Select(p => p.PhaseID).ToHashSet();

            var items = new List<InvoiceItem>();
            foreach (var i in lines)
            {
                if (i.ExpenseID.HasValue)
                {
                    if (!expenses.TryGetValue(i.ExpenseID.Value, out var expense) || expense.ProjectID != projectId)
                        return (null, "An expense on this invoice no longer exists for this project. Remove that line and try again.");
                    if (!expense.IsRecoverable)
                        return (null, $"\"{expense.Description}\" is a company cost, not a recoverable expense, so it can't be billed to the client.");
                    if (links.TryGetValue(expense.ExpenseID, out var link) && link.InvoiceID != currentInvoiceId)
                        return (null, $"\"{expense.Description}\" is already billed on invoice {link.InvoiceNumber}.");

                    var description = string.IsNullOrWhiteSpace(i.Description)
                        ? $"Reimbursement: {expense.Description}"
                        : i.Description.Trim();
                    if (description.Length > 200) description = description[..200];

                    items.Add(new InvoiceItem
                    {
                        Description = description,
                        Quantity = 1,
                        Rate = expense.Amount,
                        Amount = expense.Amount,
                        PhaseID = expense.PhaseID,
                        ExpenseID = expense.ExpenseID
                    });
                    continue;
                }

                // A normal line: a positive quantity, a rate that isn't negative, sensible sizes.
                var text = (i.Description ?? string.Empty).Trim();
                if (text.Length > 200) return (null, "A line description can be at most 200 characters.");
                // Rounded first, so 0.004 can't pass the check and be saved as 0
                var qty = Math.Round(i.Quantity, 2);
                var rate = Math.Round(i.Rate, 2);
                if (qty <= 0) return (null, $"\"{(text.Length > 0 ? text : "A line")}\" needs a quantity greater than zero.");
                if (rate < 0) return (null, $"\"{(text.Length > 0 ? text : "A line")}\" can't have a negative rate.");
                if (qty > 1_000_000_000m || rate > MaxAmount || qty * rate > MaxAmount)
                    return (null, $"\"{(text.Length > 0 ? text : "A line")}\" is too large.");
                if (i.PhaseID != null && !phaseIds.Contains(i.PhaseID.Value))
                    return (null, "A line points to a phase of another project. Pick the phase again.");

                items.Add(new InvoiceItem
                {
                    Description = text,
                    Quantity = qty,
                    Rate = rate,
                    Amount = Math.Round(qty * rate, 2),
                    PhaseID = i.PhaseID
                });
            }

            return (items, null);
        }

        private static InvoiceDto BuildInvoiceDto(Invoice invoice, List<InvoiceItem> items, List<InvoicePayment> payments)
        {
            decimal subtotal = items.Sum(x => x.Amount);
            decimal total = subtotal + invoice.TaxAmount;
            decimal paid = payments.Sum(p => p.Amount);
            decimal due = total - paid;

            return new InvoiceDto
            {
                InvoiceID = invoice.InvoiceID,
                InvoiceNumber = invoice.InvoiceNumber,
                IssueDate = invoice.IssueDate,
                DueDate = invoice.DueDate,
                Subtotal = subtotal,
                TaxAmount = invoice.TaxAmount,
                Total = total,
                Paid = paid,
                Due = due,
                Status = DeriveStatus(total, paid, due, invoice.DueDate),
                Notes = invoice.Notes,
                Items = items.Select(x => new InvoiceItemDto
                {
                    ItemID = x.ItemID,
                    Description = x.Description,
                    Quantity = x.Quantity,
                    Rate = x.Rate,
                    Amount = x.Amount,
                    PhaseID = x.PhaseID,
                    ExpenseID = x.ExpenseID
                }).ToList(),
                Payments = payments.Select(p => new InvoicePaymentDto
                {
                    PaymentID = p.PaymentID,
                    Amount = p.Amount,
                    PaymentDate = p.PaymentDate,
                    Method = p.Method,
                    Reference = p.Reference
                }).ToList()
            };
        }

        // Status is worked out, never stored: Paid if nothing is due, Overdue if a balance is past
        // the due date, Partial if some money is in, otherwise Unpaid.
        private static string DeriveStatus(decimal total, decimal paid, decimal due, DateTime? dueDate)
        {
            if (total > 0 && due <= 0) return "Paid";
            if (due > 0 && dueDate.HasValue && dueDate.Value.Date < AppTime.Now.Date) return "Overdue";
            if (paid > 0) return "Partial";
            return "Unpaid";
        }
    }
}
