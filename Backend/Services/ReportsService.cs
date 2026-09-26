using Backend.Models.DTOs;
using Backend.Repositories;

namespace Backend.Services
{
    // Aggregates data from every module into one company report. Where a figure already
    // has an owner elsewhere (project profit/cost, billing totals, payroll), this service
    // reuses that exact logic so the numbers match the rest of the app.
    public class ReportsService : IReportsService
    {
        private readonly IProjectService _projectService;
        private readonly IProjectRepository _projectRepository;
        private readonly IBillingService _billingService;
        private readonly IBillingRepository _billingRepository;
        private readonly IMaterialRepository _materialRepository;
        private readonly IEmployeeRepository _employeeRepository;
        private readonly IAssignmentRepository _assignmentRepository;
        private readonly IAttendanceRepository _attendanceRepository;
        private readonly ISalaryService _salaryService;
        private readonly IProjectExpenseRepository _expenseRepository;

        private static readonly string[] MonthShort =
        {
            "", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
        };
        private static readonly string[] MonthFull =
        {
            "", "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"
        };

        public ReportsService(
            IProjectService projectService,
            IProjectRepository projectRepository,
            IBillingService billingService,
            IBillingRepository billingRepository,
            IMaterialRepository materialRepository,
            IEmployeeRepository employeeRepository,
            IAssignmentRepository assignmentRepository,
            IAttendanceRepository attendanceRepository,
            ISalaryService salaryService,
            IProjectExpenseRepository expenseRepository)
        {
            _projectService = projectService;
            _projectRepository = projectRepository;
            _billingService = billingService;
            _billingRepository = billingRepository;
            _materialRepository = materialRepository;
            _employeeRepository = employeeRepository;
            _assignmentRepository = assignmentRepository;
            _attendanceRepository = attendanceRepository;
            _salaryService = salaryService;
            _expenseRepository = expenseRepository;
        }

        public async Task<ReportsDto> GetReportsAsync()
        {
            var report = new ReportsDto();

            // Billing overview (per-project billed/received/outstanding + overdue).
            var billing = await _billingService.GetOverviewAsync();
            var billByProject = billing.Projects.ToDictionary(p => p.ProjectID);

            // Projects + their financials (reused project logic → consistent profit/cost).
            var projects = await _projectService.GetAllProjectsAsync();

            decimal totalBudget = 0, totalMaterial = 0, totalLabour = 0, totalExpense = 0, totalProfit = 0;
            decimal recoverableTotal = 0, recoverableInvoiced = 0;
            var liveProjectIds = new HashSet<int>();
            int active = 0, completed = 0, cancelled = 0;
            var statusCounts = new Dictionary<string, int>();
            var labourByProject = new List<SliceDto>();

            foreach (var p in projects)
            {
                var detail = await _projectService.GetProjectDetailAsync(p.ProjectID);
                var fin = detail?.Financials;

                decimal budget = fin?.Budget ?? p.Budget;
                decimal material = fin?.MaterialCost ?? 0m;
                decimal labour = fin?.LabourCost ?? 0m;
                decimal expense = fin?.ExpenseCost ?? 0m;
                decimal cost = fin?.ActualCost ?? 0m;
                decimal profit = fin?.Profit ?? (budget - cost);

                // A cancelled project's budget is never realised, so it must not inflate the
                // company's budget/cost/profit totals. It still appears in the projects table
                // and the status breakdown as a record.
                bool isCancelled = p.Status == "Cancelled";
                if (!isCancelled)
                {
                    totalBudget += budget;
                    totalMaterial += material;
                    totalLabour += labour;
                    totalExpense += expense;
                    totalProfit += profit;
                    recoverableTotal += fin?.RecoverableTotal ?? 0m;
                    recoverableInvoiced += fin?.RecoverableInvoiced ?? 0m;
                    liveProjectIds.Add(p.ProjectID);
                    if (labour > 0) labourByProject.Add(new SliceDto { Label = p.Title, Value = labour });
                }

                if (p.Status == "Completed") completed++;
                else if (p.Status == "In Progress") active++;
                else if (isCancelled) cancelled++;
                statusCounts[p.Status] = statusCounts.GetValueOrDefault(p.Status, 0) + 1;

                var b = billByProject.GetValueOrDefault(p.ProjectID);
                report.Projects.Add(new ProjectReportRowDto
                {
                    ProjectID = p.ProjectID,
                    Title = p.Title,
                    ClientName = p.ClientName,
                    Status = p.Status,
                    Progress = p.OverallProgress,
                    Budget = budget,
                    Cost = cost,
                    Profit = profit,
                    MarginPercent = budget > 0 ? Math.Round(profit / budget * 100m, 1) : 0m,
                    Billed = b?.Billed ?? 0m,
                    Received = b?.Received ?? 0m,
                    Outstanding = b?.Outstanding ?? 0m
                });
            }

            report.Projects = report.Projects.OrderByDescending(r => r.Budget).ToList();

            decimal totalCost = totalMaterial + totalLabour + totalExpense;

            // Company expense cost by category, for live (non-cancelled) projects only.
            var allExpenses = await _expenseRepository.GetAllAsync();
            var expensesByCategory = allExpenses
                .Where(e => !e.IsRecoverable && liveProjectIds.Contains(e.ProjectID))
                .GroupBy(e => e.Category)
                .Select(g => new SliceDto { Label = g.Key, Value = g.Sum(e => e.Amount) })
                .Where(s => s.Value > 0)
                .OrderByDescending(s => s.Value)
                .ToList();
            decimal totalBilled = billing.Projects.Sum(p => p.Billed);
            decimal totalReceived = billing.Projects.Sum(p => p.Received);
            decimal totalOutstanding = billing.Projects.Sum(p => p.Outstanding);

            report.Financial = new FinancialReportDto
            {
                TotalBudget = totalBudget,
                MaterialCost = totalMaterial,
                LabourCost = totalLabour,
                ExpenseCost = totalExpense,
                TotalCost = totalCost,
                TotalProfit = totalProfit,
                MarginPercent = totalBudget > 0 ? Math.Round(totalProfit / totalBudget * 100m, 1) : 0m,
                TotalBilled = totalBilled,
                TotalReceived = totalReceived,
                Outstanding = totalOutstanding,
                Overdue = billing.OverdueAmount,
                ProjectCount = projects.Count,
                LiveProjects = projects.Count - cancelled,
                CancelledProjects = cancelled,
                ActiveProjects = active,
                CompletedProjects = completed,
                RevenueTrend = await BuildRevenueTrendAsync(),
                ProjectStatus = statusCounts.Select(kv => new SliceDto { Label = kv.Key, Value = kv.Value }).ToList(),
                ExpensesByCategory = expensesByCategory,
                RecoverableTotal = recoverableTotal,
                RecoverablePending = recoverableTotal - recoverableInvoiced
            };

            report.Materials = await BuildMaterialsAsync();
            report.Workforce = await BuildWorkforceAsync(
                labourByProject.OrderByDescending(s => s.Value).Take(8).ToList());

            return report;
        }

        // Last 6 months of invoiced (by issue date) vs received (by payment date).
        private async Task<List<MonthPointDto>> BuildRevenueTrendAsync()
        {
            var invoices = await _billingRepository.GetAllInvoicesAsync();
            var invoiceIds = invoices.Select(i => i.InvoiceID).ToList();
            var items = await _billingRepository.GetItemsByInvoiceIdsAsync(invoiceIds);
            var payments = await _billingRepository.GetPaymentsByInvoiceIdsAsync(invoiceIds);

            var subtotalByInvoice = items.GroupBy(x => x.InvoiceID)
                .ToDictionary(g => g.Key, g => g.Sum(x => x.Amount));

            var now = DateTime.Now;
            var months = new List<(int Year, int Month, string Label)>();
            for (int i = 5; i >= 0; i--)
            {
                var d = now.AddMonths(-i);
                months.Add((d.Year, d.Month, $"{MonthShort[d.Month]} {d.Year % 100:00}"));
            }

            var points = months.Select(m => new MonthPointDto { Label = m.Label }).ToList();

            foreach (var inv in invoices)
            {
                decimal total = subtotalByInvoice.GetValueOrDefault(inv.InvoiceID, 0m) + inv.TaxAmount;
                for (int i = 0; i < months.Count; i++)
                    if (inv.IssueDate.Year == months[i].Year && inv.IssueDate.Month == months[i].Month)
                        points[i].Billed += total;
            }
            foreach (var pay in payments)
            {
                for (int i = 0; i < months.Count; i++)
                    if (pay.PaymentDate.Year == months[i].Year && pay.PaymentDate.Month == months[i].Month)
                        points[i].Received += pay.Amount;
            }

            return points;
        }

        private async Task<MaterialsReportDto> BuildMaterialsAsync()
        {
            var materials = await _materialRepository.GetAllAsync();
            var stats = await _materialRepository.GetStatsMapAsync();

            var rows = new List<MaterialReportRowDto>();
            var byCategory = new Dictionary<string, decimal>();
            decimal totalInventory = 0, totalPurchased = 0, totalIssued = 0;
            int low = 0, outOf = 0;

            foreach (var m in materials)
            {
                stats.TryGetValue(m.MaterialID, out var st);
                decimal stock = st?.Stock ?? 0m;
                decimal avg = st?.AvgCost ?? 0m;
                decimal purchased = st?.Invested ?? 0m;
                decimal inventoryValue = Math.Round(stock * avg, 2);
                decimal issued = Math.Max(0m, purchased - inventoryValue);

                string state = stock <= 0 ? "Out" : (stock <= m.LowStockThreshold ? "Low" : "OK");
                if (state == "Out") outOf++;
                else if (state == "Low") low++;

                totalInventory += inventoryValue;
                totalPurchased += purchased;
                totalIssued += issued;
                byCategory[m.Category] = byCategory.GetValueOrDefault(m.Category, 0m) + inventoryValue;

                rows.Add(new MaterialReportRowDto
                {
                    MaterialID = m.MaterialID,
                    Name = m.Name,
                    Category = m.Category,
                    Unit = m.Unit,
                    Stock = stock,
                    AvgCost = avg,
                    InventoryValue = inventoryValue,
                    Purchased = purchased,
                    Issued = issued,
                    StockState = state
                });
            }

            return new MaterialsReportDto
            {
                TotalMaterials = materials.Count,
                LowStock = low,
                OutOfStock = outOf,
                InventoryValue = totalInventory,
                TotalPurchased = totalPurchased,
                TotalIssued = totalIssued,
                TopMaterials = rows.OrderByDescending(r => r.InventoryValue).Take(8).ToList(),
                ByCategory = byCategory
                    .Where(kv => kv.Value > 0)
                    .OrderByDescending(kv => kv.Value)
                    .Select(kv => new SliceDto { Label = kv.Key, Value = kv.Value })
                    .ToList()
            };
        }

        private async Task<WorkforceReportDto> BuildWorkforceAsync(List<SliceDto> labourByProject)
        {
            var employees = await _employeeRepository.GetAllAsync();
            var assignments = await _assignmentRepository.GetAllAsync();

            // Attendance present/absent across all daily assignments.
            var dailyIds = assignments.Where(a => a.WageType == "Daily").Select(a => a.AssignmentID).ToList();
            var attendance = await _attendanceRepository.GetByAssignmentIdsAsync(dailyIds);
            int present = attendance.Count(r => r.Status == "Present");
            int absent = attendance.Count(r => r.Status == "Absent");

            // Current-month payroll (reuses salary logic).
            var now = DateTime.Now;
            var period = await _salaryService.GetPeriodAsync(now.Year, now.Month, null);

            // Employee count per designation.
            var byDesignation = employees
                .GroupBy(e => string.IsNullOrWhiteSpace(e.Designation) ? "Unspecified" : e.Designation)
                .Select(g => new SliceDto { Label = g.Key, Value = g.Count() })
                .OrderByDescending(s => s.Value)
                .ToList();

            return new WorkforceReportDto
            {
                TotalEmployees = employees.Count,
                ActiveEmployees = employees.Count(e => e.Status == "Active"),
                TotalAssignments = assignments.Count,
                ActiveAssignments = assignments.Count(a => a.Status == "Active"),
                PresentCount = present,
                AbsentCount = absent,
                PresentRate = (present + absent) > 0 ? Math.Round((decimal)present / (present + absent) * 100m, 1) : 0m,
                PayrollPeriod = $"{MonthFull[now.Month]} {now.Year}",
                PayrollTotal = period.TotalPayroll,
                PayrollPaid = period.Paid,
                PayrollPending = period.Pending,
                LabourByProject = labourByProject,
                ByDesignation = byDesignation
            };
        }
    }
}
