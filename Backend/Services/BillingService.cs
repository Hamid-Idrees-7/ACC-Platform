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

        public BillingService(
            IProjectRepository projectRepository,
            IClientRepository clientRepository,
            IBillingRepository billingRepository)
        {
            _projectRepository = projectRepository;
            _clientRepository = clientRepository;
            _billingRepository = billingRepository;
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

                decimal billed = 0m, received = 0m;
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

        // Project detail 
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
                PercentInvoiced = project.Budget > 0 ? Math.Round(totalInvoiced / project.Budget * 100m, 1) : 0m,
                Invoices = invoiceDtos,
                Phases = phases.Select(ph => new PhaseOptionDto { PhaseID = ph.PhaseID, Name = ph.Name }).ToList()
            };
        }

        // Create 
        public async Task<int> CreateInvoiceAsync(CreateInvoiceDto dto)
        {
            int seq = await _billingRepository.MaxInvoiceSeqAsync() + 1;

            var invoice = new Invoice
            {
                InvoiceNumber = $"INV-{seq:0000}",
                ProjectID = dto.ProjectID,
                IssueDate = dto.IssueDate == default ? DateTime.Now : dto.IssueDate,
                DueDate = dto.DueDate,
                TaxAmount = dto.TaxAmount,
                Notes = string.IsNullOrWhiteSpace(dto.Notes) ? null : dto.Notes.Trim(),
                CreatedAt = DateTime.Now
            };

            var items = BuildItems(dto.Items);
            return await _billingRepository.AddInvoiceAsync(invoice, items);
        }

        // Update
        public async Task<bool> UpdateInvoiceAsync(int invoiceId, CreateInvoiceDto dto)
        {
            var invoice = await _billingRepository.GetInvoiceByIdAsync(invoiceId);
            if (invoice == null) return false;

            // InvoiceNumber and ProjectID stay fixed once created.
            invoice.IssueDate = dto.IssueDate == default ? invoice.IssueDate : dto.IssueDate;
            invoice.DueDate = dto.DueDate;
            invoice.TaxAmount = dto.TaxAmount;
            invoice.Notes = string.IsNullOrWhiteSpace(dto.Notes) ? null : dto.Notes.Trim();

            await _billingRepository.UpdateInvoiceAsync(invoice);
            await _billingRepository.ReplaceItemsAsync(invoiceId, BuildItems(dto.Items));
            return true;
        }

        public async Task<bool> DeleteInvoiceAsync(int invoiceId)
        {
            return await _billingRepository.DeleteInvoiceAsync(invoiceId);
        }

        // Payments 
        public async Task<bool> RecordPaymentAsync(RecordPaymentDto dto)
        {
            var invoice = await _billingRepository.GetInvoiceByIdAsync(dto.InvoiceID);
            if (invoice == null) return false;

            await _billingRepository.AddPaymentAsync(new InvoicePayment
            {
                InvoiceID = dto.InvoiceID,
                Amount = dto.Amount,
                PaymentDate = dto.PaymentDate == default ? DateTime.Now : dto.PaymentDate,
                Method = string.IsNullOrWhiteSpace(dto.Method) ? "Cash" : dto.Method.Trim(),
                Reference = string.IsNullOrWhiteSpace(dto.Reference) ? null : dto.Reference.Trim(),
                CreatedAt = DateTime.Now
            });
            return true;
        }

        public async Task<bool> DeletePaymentAsync(int paymentId)
        {
            return await _billingRepository.DeletePaymentAsync(paymentId);
        }

        // Printable invoice
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
                GeneratedAt = DateTime.Now
            };
        }

        // Helpers

        // Build line-item entities from the raw input; Amount is computed as Quantity x Rate.
        private static List<InvoiceItem> BuildItems(List<CreateInvoiceItemDto> input)
        {
            return (input ?? new List<CreateInvoiceItemDto>())
                .Where(i => !string.IsNullOrWhiteSpace(i.Description) || i.Rate != 0)
                .Select(i =>
                {
                    decimal qty = i.Quantity == 0 ? 1 : i.Quantity;
                    return new InvoiceItem
                    {
                        Description = (i.Description ?? string.Empty).Trim(),
                        Quantity = qty,
                        Rate = i.Rate,
                        Amount = qty * i.Rate,
                        PhaseID = i.PhaseID
                    };
                })
                .ToList();
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
                    PhaseID = x.PhaseID
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

        // Status is derived, never stored: Paid if nothing due; Overdue if a balance is past due date;
        // Partial if some money is in; otherwise Unpaid.
        private static string DeriveStatus(decimal total, decimal paid, decimal due, DateTime? dueDate)
        {
            if (total > 0 && due <= 0) return "Paid";
            if (due > 0 && dueDate.HasValue && dueDate.Value.Date < DateTime.Now.Date) return "Overdue";
            if (paid > 0) return "Partial";
            return "Unpaid";
        }
    }
}
