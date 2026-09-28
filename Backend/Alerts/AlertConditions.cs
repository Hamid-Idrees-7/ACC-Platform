using System.Globalization;
using Backend.Models.Entities;

namespace Backend.Alerts
{
    public static class AlertConditions
    {
        private static readonly CultureInfo En = CultureInfo.InvariantCulture;

        public static List<Alert> Find(AlertFacts facts, AlertRuleSet rules)
        {
            var finder = new Finder(facts);
            var found = new List<Alert>();

            void Add(string type, Func<int, IEnumerable<Alert>> find)
            {
                if (rules.IsEnabled(type)) found.AddRange(find(rules.Threshold(type)));
            }

            Add(AlertTypes.BudgetWarning, finder.BudgetWarning);
            Add(AlertTypes.BudgetOver, _ => finder.BudgetOver());
            Add(AlertTypes.InvoiceDueSoon, finder.InvoiceDueSoon);
            Add(AlertTypes.InvoiceOverdue, _ => finder.InvoiceOverdue());
            Add(AlertTypes.FinalBill, _ => finder.FinalBill());
            Add(AlertTypes.UnbilledExpenses, finder.UnbilledExpenses);
            Add(AlertTypes.SalaryPending, finder.SalaryPending);
            Add(AlertTypes.LowStock, _ => finder.LowStock());
            Add(AlertTypes.OutOfStock, _ => finder.OutOfStock());
            Add(AlertTypes.MaterialRequestPending, finder.MaterialRequestPending);
            Add(AlertTypes.ApprovalPending, finder.ApprovalPending);
            Add(AlertTypes.InquiryUnread, finder.InquiryUnread);
            Add(AlertTypes.DeadlineNear, finder.DeadlineNear);
            Add(AlertTypes.ProjectLate, _ => finder.ProjectLate());
            Add(AlertTypes.ReadyToComplete, _ => finder.ReadyToComplete());
            Add(AlertTypes.ProjectStalled, finder.ProjectStalled);
            Add(AlertTypes.AttendanceMissing, finder.AttendanceMissing);
            Add(AlertTypes.AbsentStreak, finder.AbsentStreak);
            Add(AlertTypes.AssignmentEnded, _ => finder.AssignmentEnded());

            return found
                .GroupBy(a => a.Key)
                .Select(g => g.First())
                .ToList();
        }

        public static Alert Make(string type, string key, string title, string message, string? link,
            int? projectId = null, int? userId = null)
        {
            return new Alert
            {
                Type = type,
                Key = Cut($"{type}:{key}", 120),
                Severity = AlertCatalog.Get(type)?.Severity ?? AlertSeverities.Warning,
                Title = Cut(title, 150),
                Message = Cut(message, 400),
                Link = link == null ? null : Cut(link, 200),
                ProjectID = projectId,
                UserID = userId
            };
        }

        public const int AttendanceLookbackDays = 7;

        public static bool IsPastLookback(Alert alert, DateTime now)
        {
            if (alert.Type != AlertTypes.AttendanceMissing) return false;
            var stamp = alert.Key[(alert.Key.LastIndexOf(':') + 1)..];
            return DateTime.TryParseExact(stamp, "yyyyMMdd", En, DateTimeStyles.None, out var day)
                && day < now.Date.AddDays(-(AttendanceLookbackDays - 1));
        }

        public static string Date(DateTime value) => value.ToString("d MMM yyyy", En);

        private static string Day(DateTime value) => value.ToString("ddd d MMM", En);

        private static string Plural(int count, string word) => $"{count} {word}{(count == 1 ? "" : "s")}";

        private static string Quantity(decimal value) => value.ToString("0.##", En);

        private static string Cut(string value, int max) => value.Length <= max ? value : value[..(max - 1)].TrimEnd() + "…";

        private static string Ago(TimeSpan age)
        {
            var hours = Math.Max(1, (int)Math.Floor(age.TotalHours));
            return hours < 48 ? $"{Plural(hours, "hour")} ago" : $"{Plural((int)Math.Floor(age.TotalDays), "day")} ago";
        }

        private static string JoinAnd(List<string> parts) =>
            parts.Count <= 1 ? string.Join("", parts) : $"{string.Join(", ", parts.Take(parts.Count - 1))} and {parts[^1]}";

        private static string InDays(int days) =>
            days <= 0 ? "today" : days == 1 ? "tomorrow" : $"in {days} days";

        private sealed class Finder
        {
            private readonly AlertFacts _f;
            private readonly DateTime _now;
            private readonly DateTime _today;
            private readonly Dictionary<int, List<ProjectPhase>> _phases;
            private readonly Dictionary<int, List<ProjectExpense>> _expenses;
            private readonly HashSet<int> _billedExpenses;
            private readonly Dictionary<int, decimal> _invoiceSubtotal;
            private readonly Dictionary<int, decimal> _invoicePaid;
            private readonly Dictionary<int, decimal> _invoiceReimbursed;
            private readonly Dictionary<int, List<Assignment>> _assignments;
            private readonly Dictionary<int, List<Attendance>> _attendance;
            private readonly Dictionary<int, Employee> _employees;
            private readonly Dictionary<int, Material> _materials;
            private readonly Dictionary<int, Project> _projects;

            public Finder(AlertFacts facts)
            {
                _f = facts;
                _now = facts.Now;
                _today = facts.Now.Date;
                _projects = facts.Projects.ToDictionary(p => p.ProjectID);
                _phases = facts.Phases.GroupBy(p => p.ProjectID).ToDictionary(g => g.Key, g => g.ToList());
                _expenses = facts.Expenses.GroupBy(e => e.ProjectID).ToDictionary(g => g.Key, g => g.ToList());
                _billedExpenses = facts.InvoiceItems.Where(i => i.ExpenseID.HasValue).Select(i => i.ExpenseID!.Value).ToHashSet();
                _invoiceSubtotal = facts.InvoiceItems.GroupBy(i => i.InvoiceID).ToDictionary(g => g.Key, g => g.Sum(i => i.Amount));
                _invoiceReimbursed = facts.InvoiceItems.Where(i => i.ExpenseID.HasValue).GroupBy(i => i.InvoiceID).ToDictionary(g => g.Key, g => g.Sum(i => i.Amount));
                _invoicePaid = facts.InvoicePayments.GroupBy(p => p.InvoiceID).ToDictionary(g => g.Key, g => g.Sum(p => p.Amount));
                _assignments = facts.Assignments.GroupBy(a => a.ProjectID).ToDictionary(g => g.Key, g => g.ToList());
                _attendance = facts.Attendance.GroupBy(a => a.AssignmentID).ToDictionary(g => g.Key, g => g.ToList());
                _employees = facts.Employees.ToDictionary(e => e.EmployeeID);
                _materials = facts.Materials.ToDictionary(m => m.MaterialID);
            }

            private static bool IsClosed(Project p) => p.Status is "Completed" or "Cancelled";

            private static bool IsRunning(Project p) => p.Status == "In Progress";

            private List<ProjectPhase> PhasesOf(int projectId) => _phases.GetValueOrDefault(projectId) ?? new List<ProjectPhase>();

            private int Progress(int projectId)
            {
                var phases = PhasesOf(projectId);
                return phases.Count == 0 ? 0 : (int)Math.Round(phases.Average(p => p.Progress));
            }

            private string ProjectTitle(int projectId) => _projects.TryGetValue(projectId, out var p) ? p.Title : "A project";

            private string EmployeeName(int employeeId) => _employees.TryGetValue(employeeId, out var e) ? e.FullName : "A worker";

            private decimal InvoiceTotal(Invoice invoice) => _invoiceSubtotal.GetValueOrDefault(invoice.InvoiceID) + invoice.TaxAmount;

            private decimal InvoiceDue(Invoice invoice) => InvoiceTotal(invoice) - _invoicePaid.GetValueOrDefault(invoice.InvoiceID);

            private static string ProjectLink(int projectId) => $"/dashboard/projects/{projectId}";

            private static string BillingLink(int projectId, int? invoiceId = null) =>
                invoiceId.HasValue ? $"/dashboard/billing/project/{projectId}?highlight={invoiceId}" : $"/dashboard/billing/project/{projectId}";

            private decimal ProjectCost(Project project)
            {
                var materials = _f.MaterialTransactions
                    .Where(t => t.Type == "Issue" && t.ProjectID == project.ProjectID)
                    .Sum(t => t.Quantity * t.Rate);

                var assignments = _assignments.GetValueOrDefault(project.ProjectID) ?? new List<Assignment>();
                var labour = assignments.Where(a => a.WageType == "Contract").Sum(a => a.WageAmount)
                    + assignments.Where(a => a.WageType == "Daily").Sum(a => _f.PresentDays.GetValueOrDefault(a.AssignmentID) * a.WageAmount);

                var expenses = (_expenses.GetValueOrDefault(project.ProjectID) ?? new List<ProjectExpense>())
                    .Where(e => !e.IsRecoverable)
                    .Sum(e => e.Amount);

                return materials + labour + expenses;
            }

            private IEnumerable<(Project Project, int Percent, decimal Cost)> BudgetUse()
            {
                foreach (var p in _f.Projects.Where(p => !IsClosed(p) && p.Budget > 0))
                {
                    var cost = ProjectCost(p);
                    var percent = (int)Math.Min(Math.Floor(cost / p.Budget * 100m), 99999m);
                    yield return (p, percent, cost);
                }
            }

            public IEnumerable<Alert> BudgetWarning(int threshold)
            {
                foreach (var (p, percent, cost) in BudgetUse())
                {
                    if (percent < threshold || cost > p.Budget) continue;
                    yield return Make(AlertTypes.BudgetWarning, $"{p.ProjectID}",
                        $"{p.Title}: {percent}% of the budget used",
                        $"Costs so far (materials, labour and company expenses) have reached {percent}% of the project budget.",
                        ProjectLink(p.ProjectID), p.ProjectID);
                }
            }

            public IEnumerable<Alert> BudgetOver()
            {
                foreach (var (p, percent, cost) in BudgetUse())
                {
                    if (cost <= p.Budget) continue;
                    yield return Make(AlertTypes.BudgetOver, $"{p.ProjectID}",
                        $"{p.Title} is over budget",
                        $"Costs so far (materials, labour and company expenses) are {percent}% of the project budget.",
                        ProjectLink(p.ProjectID), p.ProjectID);
                }
            }

            public IEnumerable<Alert> InvoiceDueSoon(int days)
            {
                foreach (var inv in _f.Invoices.Where(i => i.DueDate.HasValue))
                {
                    var due = inv.DueDate!.Value.Date;
                    if (due < _today || due > _today.AddDays(days) || InvoiceDue(inv) <= 0) continue;
                    var left = (int)(due - _today).TotalDays;
                    yield return Make(AlertTypes.InvoiceDueSoon, $"{inv.InvoiceID}",
                        $"Invoice {inv.InvoiceNumber} is due {InDays(left)}",
                        $"{ProjectTitle(inv.ProjectID)}: payment is due on {Date(due)} and is not fully received yet.",
                        BillingLink(inv.ProjectID, inv.InvoiceID), inv.ProjectID);
                }
            }

            public IEnumerable<Alert> InvoiceOverdue()
            {
                foreach (var inv in _f.Invoices.Where(i => i.DueDate.HasValue))
                {
                    var due = inv.DueDate!.Value.Date;
                    if (due >= _today || InvoiceDue(inv) <= 0) continue;
                    var late = (int)(_today - due).TotalDays;
                    yield return Make(AlertTypes.InvoiceOverdue, $"{inv.InvoiceID}",
                        $"Invoice {inv.InvoiceNumber} is overdue",
                        $"{ProjectTitle(inv.ProjectID)}: payment was due on {Date(due)} ({Plural(late, "day")} ago) and is not fully received.",
                        BillingLink(inv.ProjectID, inv.InvoiceID), inv.ProjectID);
                }
            }

            public IEnumerable<Alert> FinalBill()
            {
                foreach (var p in _f.Projects.Where(p => p.Status == "Completed"))
                {
                    var invoices = _f.Invoices.Where(i => i.ProjectID == p.ProjectID).ToList();
                    var totalInvoiced = invoices.Sum(InvoiceTotal);
                    var reimbursed = invoices.Sum(i => _invoiceReimbursed.GetValueOrDefault(i.InvoiceID));
                    var contractInvoiced = totalInvoiced - reimbursed;
                    var outstanding = invoices.Sum(InvoiceDue);
                    var unbilled = (_expenses.GetValueOrDefault(p.ProjectID) ?? new List<ProjectExpense>())
                        .Count(e => e.IsRecoverable && !_billedExpenses.Contains(e.ExpenseID));

                    var reasons = new List<string>();
                    if (p.Budget > 0 && contractInvoiced < p.Budget)
                        reasons.Add($"only {(int)Math.Max(Math.Floor(contractInvoiced / p.Budget * 100m), 0m)}% of the contract price is invoiced");
                    if (unbilled > 0)
                        reasons.Add($"{Plural(unbilled, "recoverable expense")} {(unbilled == 1 ? "is" : "are")} not billed");
                    if (outstanding > 0)
                        reasons.Add("invoiced payments are not fully received");
                    if (reasons.Count == 0) continue;

                    yield return Make(AlertTypes.FinalBill, $"{p.ProjectID}",
                        $"{p.Title}: final bill pending",
                        $"The project is completed, but {JoinAnd(reasons)}.",
                        BillingLink(p.ProjectID), p.ProjectID);
                }
            }

            public IEnumerable<Alert> UnbilledExpenses(int days)
            {
                var cutoff = _today.AddDays(-days);
                foreach (var p in _f.Projects.Where(p => !IsClosed(p)))
                {
                    var old = (_expenses.GetValueOrDefault(p.ProjectID) ?? new List<ProjectExpense>())
                        .Where(e => e.IsRecoverable && !_billedExpenses.Contains(e.ExpenseID) && e.ExpenseDate.Date <= cutoff)
                        .ToList();
                    if (old.Count == 0) continue;
                    yield return Make(AlertTypes.UnbilledExpenses, $"{p.ProjectID}",
                        $"{p.Title}: {Plural(old.Count, "expense")} not billed",
                        $"{Plural(old.Count, "recoverable expense")} older than {Plural(days, "day")} {(old.Count == 1 ? "is" : "are")} not on any invoice, so the client has not been asked to pay {(old.Count == 1 ? "it" : "them")}.",
                        BillingLink(p.ProjectID), p.ProjectID);
                }
            }

            public IEnumerable<Alert> SalaryPending(int dayOfMonth)
            {
                foreach (var period in _f.SalaryPeriods)
                {
                    var checkFrom = new DateTime(period.Year, period.Month, 1).AddMonths(1).AddDays(dayOfMonth - 1);
                    if (_today < checkFrom) continue;
                    var unpaid = period.Employees.Count(e => e.Lines.Any(l => !l.IsPaid && l.CalculatedAmount > 0));
                    if (unpaid == 0) continue;
                    var label = new DateTime(period.Year, period.Month, 1).ToString("MMMM yyyy", En);
                    yield return Make(AlertTypes.SalaryPending, $"{period.Year:0000}-{period.Month:00}",
                        $"{label} salaries not fully paid",
                        $"{Plural(unpaid, "employee")} still {(unpaid == 1 ? "has" : "have")} unpaid salary for {label}.",
                        $"/dashboard/salaries?year={period.Year}&month={period.Month}");
                }
            }

            private IEnumerable<(Material Material, decimal Stock, bool Used)> Stock()
            {
                var byMaterial = _f.MaterialTransactions.GroupBy(t => t.MaterialID).ToDictionary(g => g.Key, g => g.ToList());
                foreach (var m in _f.Materials.Where(m => m.Status == "Active"))
                {
                    var rows = byMaterial.GetValueOrDefault(m.MaterialID) ?? new List<MaterialTransaction>();
                    var stock = rows.Sum(t => t.Type == "Restock" ? t.Quantity : -t.Quantity);
                    yield return (m, stock, rows.Count > 0);
                }
            }

            public IEnumerable<Alert> LowStock()
            {
                foreach (var (m, stock, _) in Stock())
                {
                    if (m.LowStockThreshold <= 0 || stock <= 0 || stock > m.LowStockThreshold) continue;
                    yield return Make(AlertTypes.LowStock, $"{m.MaterialID}",
                        $"Low stock: {m.Name}",
                        $"Only {Quantity(stock)} {m.Unit} left. The low-stock level for this material is {m.LowStockThreshold} {m.Unit}.",
                        $"/dashboard/materials?highlight={m.MaterialID}");
                }
            }

            public IEnumerable<Alert> OutOfStock()
            {
                foreach (var (m, stock, used) in Stock())
                {
                    if (stock > 0 || (!used && m.LowStockThreshold <= 0)) continue;
                    yield return Make(AlertTypes.OutOfStock, $"{m.MaterialID}",
                        $"Out of stock: {m.Name}",
                        $"{m.Name} has no stock left (0 {m.Unit}). Restock it before the next site request.",
                        $"/dashboard/materials?highlight={m.MaterialID}");
                }
            }

            public IEnumerable<Alert> MaterialRequestPending(int hours)
            {
                foreach (var r in _f.PendingMaterialRequests.Where(r => r.Status == "Pending" && r.CreatedAt <= _now.AddHours(-hours)))
                {
                    _materials.TryGetValue(r.MaterialID, out var m);
                    var name = m?.Name ?? "material";
                    yield return Make(AlertTypes.MaterialRequestPending, $"{r.RequestID}",
                        $"Material request waiting: {name}",
                        $"The request for {$"{Quantity(r.Quantity)} {m?.Unit}".Trim()} for {ProjectTitle(r.ProjectID)} was sent {Ago(_now - r.CreatedAt)} and still has no decision.",
                        $"/dashboard/material-requests?highlight={r.RequestID}", r.ProjectID);
                }
            }

            public IEnumerable<Alert> ApprovalPending(int hours)
            {
                foreach (var a in _f.PendingApprovals.Where(a => a.Status == "Pending" && a.CreatedAt <= _now.AddHours(-hours)))
                {
                    var item = a.Module.TrimEnd('s').ToLowerInvariant();
                    yield return Make(AlertTypes.ApprovalPending, $"{a.PendingActionID}",
                        $"Approval waiting: {a.Action.ToLowerInvariant()} {item} {a.TargetName}",
                        $"{a.RequestedByName} asked {Ago(_now - a.CreatedAt)} and the request still has no decision.",
                        $"/dashboard/approvals?highlight={a.PendingActionID}");
                }
            }

            public IEnumerable<Alert> InquiryUnread(int hours)
            {
                var waiting = _f.UnreadInquiries.Where(i => !i.IsRead && i.CreatedAt <= _now.AddHours(-hours)).ToList();
                if (waiting.Count == 0) yield break;
                var oldest = waiting.Min(i => i.CreatedAt);
                yield return Make(AlertTypes.InquiryUnread, "all",
                    $"{Plural(waiting.Count, "website message")} not read",
                    $"The oldest arrived {Ago(_now - oldest)}. Visitors who contact the company are waiting for a reply.",
                    "/dashboard/queries");
            }

            public IEnumerable<Alert> DeadlineNear(int days)
            {
                foreach (var p in _f.Projects.Where(p => IsRunning(p) && p.ExpectedEndDate.HasValue))
                {
                    var end = p.ExpectedEndDate!.Value.Date;
                    if (end < _today || end > _today.AddDays(days)) continue;
                    var left = (int)(end - _today).TotalDays;
                    yield return Make(AlertTypes.DeadlineNear, $"{p.ProjectID}",
                        $"{p.Title}: deadline {InDays(left)}",
                        $"Expected completion is {Date(end)} and the work is {Progress(p.ProjectID)}% done.",
                        ProjectLink(p.ProjectID), p.ProjectID);
                }
            }

            public IEnumerable<Alert> ProjectLate()
            {
                foreach (var p in _f.Projects.Where(p => p.Status is "In Progress" or "On Hold" && p.ExpectedEndDate.HasValue))
                {
                    var end = p.ExpectedEndDate!.Value.Date;
                    if (end >= _today) continue;
                    var late = (int)(_today - end).TotalDays;
                    yield return Make(AlertTypes.ProjectLate, $"{p.ProjectID}",
                        $"{p.Title} is late",
                        $"Expected completion was {Date(end)} ({Plural(late, "day")} ago) and the work is {Progress(p.ProjectID)}% done.",
                        ProjectLink(p.ProjectID), p.ProjectID);
                }
            }

            public IEnumerable<Alert> ReadyToComplete()
            {
                foreach (var p in _f.Projects.Where(p => p.Status is "In Progress" or "On Hold"))
                {
                    var phases = PhasesOf(p.ProjectID);
                    if (phases.Count == 0 || phases.Any(ph => ph.Progress < 100)) continue;
                    yield return Make(AlertTypes.ReadyToComplete, $"{p.ProjectID}",
                        $"{p.Title}: all phases done",
                        "Every phase is at 100%. Mark the project as Completed to close it.",
                        ProjectLink(p.ProjectID), p.ProjectID);
                }
            }

            private DateTime LastActivity(Project p)
            {
                var times = new List<DateTime> { p.CreatedAt, p.UpdatedAt };
                times.AddRange(PhasesOf(p.ProjectID).Select(ph => ph.UpdatedAt ?? ph.CreatedAt));
                times.AddRange((_expenses.GetValueOrDefault(p.ProjectID) ?? new List<ProjectExpense>()).Select(e => e.UpdatedAt));
                times.AddRange(_f.MaterialTransactions.Where(t => t.ProjectID == p.ProjectID).Select(t => t.CreatedAt));
                var invoices = _f.Invoices.Where(i => i.ProjectID == p.ProjectID).ToList();
                var invoiceIds = invoices.Select(i => i.InvoiceID).ToHashSet();
                times.AddRange(invoices.Select(i => i.CreatedAt));
                times.AddRange(_f.InvoicePayments.Where(pay => invoiceIds.Contains(pay.InvoiceID)).Select(pay => pay.CreatedAt));
                foreach (var a in _assignments.GetValueOrDefault(p.ProjectID) ?? new List<Assignment>())
                {
                    times.Add(a.UpdatedAt);
                    times.AddRange((_attendance.GetValueOrDefault(a.AssignmentID) ?? new List<Attendance>()).Select(r => r.UpdatedAt));
                }
                return times.Max();
            }

            public IEnumerable<Alert> ProjectStalled(int days)
            {
                foreach (var p in _f.Projects.Where(IsRunning))
                {
                    var last = LastActivity(p);
                    if (last > _now.AddDays(-days)) continue;
                    var idle = (int)Math.Floor((_now - last).TotalDays);
                    yield return Make(AlertTypes.ProjectStalled, $"{p.ProjectID}",
                        $"{p.Title}: no activity for {Plural(idle, "day")}",
                        $"Nothing has been recorded since {Date(last)}: no attendance, expenses, materials, billing or phase progress.",
                        ProjectLink(p.ProjectID), p.ProjectID);
                }
            }

            private bool IsWorkingDay(DateTime day)
            {
                if (_f.WeeklyOffDays.Contains(day.DayOfWeek.ToString())) return false;
                return !_f.Holidays.Any(h => day >= h.StartDate.Date && day <= h.EndDate.Date);
            }

            public IEnumerable<Alert> AttendanceMissing(int hour)
            {
                var days = Enumerable.Range(1, AttendanceLookbackDays - 1).Select(back => _today.AddDays(-back)).ToList();
                if (_now.Hour >= hour) days.Add(_today);

                foreach (var day in days.Where(IsWorkingDay))
                {
                    foreach (var p in _f.Projects.Where(IsRunning))
                    {
                        if (p.StartDate.HasValue && p.StartDate.Value.Date > day) continue;
                        var onSite = (_assignments.GetValueOrDefault(p.ProjectID) ?? new List<Assignment>())
                            .Where(a => a.WageType != "Contract" && a.StartDate.Date <= day && (a.EndDate == null || a.EndDate.Value.Date >= day))
                            .ToList();
                        if (onSite.Count == 0) continue;
                        var unmarked = onSite.Count(a => !(_attendance.GetValueOrDefault(a.AssignmentID) ?? new List<Attendance>()).Any(r => r.Date.Date == day));
                        if (unmarked == 0) continue;
                        yield return Make(AlertTypes.AttendanceMissing, $"{p.ProjectID}:{day:yyyyMMdd}",
                            $"{p.Title}: attendance not marked for {Day(day)}",
                            $"{unmarked} of {Plural(onSite.Count, "worker")} on site {(unmarked == 1 ? "has" : "have")} no attendance for {Day(day)}.",
                            $"/dashboard/attendance/{p.ProjectID}?date={day:yyyy-MM-dd}", p.ProjectID);
                    }
                }
            }

            public IEnumerable<Alert> AbsentStreak(int days)
            {
                foreach (var a in _f.Assignments.Where(a => a.Status == "Active" && a.WageType != "Contract" && (a.EndDate == null || a.EndDate.Value.Date >= _today)))
                {
                    if (!_projects.TryGetValue(a.ProjectID, out var p) || IsClosed(p)) continue;
                    var records = (_attendance.GetValueOrDefault(a.AssignmentID) ?? new List<Attendance>())
                        .OrderByDescending(r => r.Date)
                        .ToList();
                    var streak = records.TakeWhile(r => r.Status == "Absent").ToList();
                    if (streak.Count < days) continue;
                    var since = streak[^1].Date.Date;
                    var name = EmployeeName(a.EmployeeID);
                    yield return Make(AlertTypes.AbsentStreak, $"{a.AssignmentID}:{since:yyyyMMdd}",
                        $"{name} absent {streak.Count} days in a row",
                        $"{name} ({a.Role}) at {p.Title} has been marked absent since {Date(since)}.",
                        $"/dashboard/attendance/{a.ProjectID}", a.ProjectID);
                }
            }

            public IEnumerable<Alert> AssignmentEnded()
            {
                foreach (var a in _f.Assignments.Where(a => a.Status == "Active" && a.EndDate.HasValue && a.EndDate.Value.Date < _today))
                {
                    var name = EmployeeName(a.EmployeeID);
                    yield return Make(AlertTypes.AssignmentEnded, $"{a.AssignmentID}",
                        $"{name}: assignment past its end date",
                        $"The assignment at {ProjectTitle(a.ProjectID)} ended on {Date(a.EndDate!.Value)} but is still Active.",
                        $"/dashboard/assignments?highlight={a.AssignmentID}", a.ProjectID);
                }
            }
        }
    }
}
