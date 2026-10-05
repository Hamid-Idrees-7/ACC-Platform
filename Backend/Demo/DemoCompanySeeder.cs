using Backend.Data;
using Backend.Models.Entities;
using static Backend.Demo.DemoCompany;

namespace Backend.Demo
{
    // Writes the sample company from DemoCompany into a new visitor database: people, projects,
    // stock, expenses, attendance, salaries, invoices, requests and website messages.
    // Everything derived (issue cost, attendance marks, salary amounts, invoice totals) is worked
    // out here with the same rules the modules use, so every page and report agrees.
    // No notifications are created: those only come from what the visitor does.
    public static class DemoCompanySeeder
    {
        private static readonly string[] PhonePrefixes = { "0300", "0301", "0311", "0321", "0333", "0345" };

        public static async Task SeedAsync(AppDbContext db, User admin, User manager, User engineer, CancellationToken ct)
        {
            var now = AppTime.Now;
            var today = now.Date;
            DateTime Day(int offset, int hour = 10) => today.AddDays(offset).AddHours(hour);

            // Holidays
            var holidays = new HashSet<DateTime>();
            for (int year = today.Year - 2; year <= today.Year; year++)
            {
                foreach (var (month, day, name) in Holidays)
                {
                    var date = new DateTime(year, month, day);
                    holidays.Add(date);
                    db.CompanyHolidays.Add(new CompanyHoliday { Name = name, StartDate = date, EndDate = date, CreatedAt = date.AddDays(-30) });
                }
            }

            // Clients
            var clients = new Dictionary<string, Client>();
            foreach (var c in Clients)
            {
                clients[c.Key] = new Client
                {
                    FullName = c.Name, ClientType = c.Type, Phone = c.Phone, CNIC = c.Cnic, City = c.City, Address = c.Address,
                    Status = "Active", CreatedAt = Day(-480), UpdatedAt = Day(-480)
                };
            }
            db.Clients.AddRange(clients.Values);

            // Employees join ten days before their first assignment
            var employees = new Dictionary<string, Employee>();
            for (int i = 0; i < Employees.Length; i++)
            {
                var e = Employees[i];
                var first = Assignments.Where(a => a.Employee == e.Name).Min(a => a.Start);
                var cnicArea = e.City == "Lahore" ? "35202" : "37405";
                employees[e.Name] = new Employee
                {
                    FullName = e.Name,
                    Designation = e.Designation,
                    Phone = $"{PhonePrefixes[i % PhonePrefixes.Length]}-{4100000 + i * 137:0000000}",
                    CNIC = $"{cnicArea}-{2100000 + i * 241:0000000}-{i % 9 + 1}",
                    City = e.City,
                    JoiningDate = today.AddDays(first - 10),
                    Status = "Active",
                    CreatedAt = Day(first - 10),
                    UpdatedAt = Day(first - 10)
                };
            }
            db.Employees.AddRange(employees.Values);
            await db.SaveChangesAsync(ct);

            // The Site Engineer demo login works on the running project
            var runningProject = Projects.First(p => p.Status == "In Progress").Key;
            var engineerName = Assignments.First(a => a.Project == runningProject && a.WageType == "Monthly"
                && employees[a.Employee].Designation == "Site Engineer").Employee;
            engineer.EmployeeID = employees[engineerName].EmployeeID;

            // Projects and phases
            var projects = new Dictionary<string, Project>();
            foreach (var p in Projects)
            {
                projects[p.Key] = new Project
                {
                    Title = p.Title, ClientID = clients[p.Client].ClientID, ProjectType = p.Type, AreaSize = p.Area,
                    Location = p.Location, Description = p.Description, StartDate = today.AddDays(p.Start),
                    ExpectedEndDate = today.AddDays(p.End), Budget = p.Budget, Status = p.Status,
                    CreatedAt = Day(p.Start), UpdatedAt = Day(Math.Min(p.End, 0))
                };
            }
            db.Projects.AddRange(projects.Values);
            await db.SaveChangesAsync(ct);

            var phases = new Dictionary<(string, int), ProjectPhase>();
            foreach (var group in Phases.GroupBy(ph => ph.Project))
            {
                int order = 1;
                foreach (var ph in group)
                {
                    phases[(group.Key, order)] = new ProjectPhase
                    {
                        ProjectID = projects[group.Key].ProjectID, Name = ph.Name, OrderNo = order,
                        Progress = ph.Progress,
                        Status = ph.Progress >= 100 ? "Completed" : ph.Progress > 0 ? "In Progress" : "Pending",
                        CreatedAt = projects[group.Key].CreatedAt
                    };
                    order++;
                }
            }
            db.ProjectPhases.AddRange(phases.Values);

            // Materials
            var materials = Materials.ToDictionary(m => m.Name, m => new Material
            {
                Name = m.Name, Category = m.Category, Unit = m.Unit, LowStockThreshold = m.LowStock, Status = m.Status,
                CreatedAt = Day(-480), UpdatedAt = Day(-480)
            });
            db.Materials.AddRange(materials.Values);
            await db.SaveChangesAsync(ct);

            // Stock: purchases and issues in date order, each issue costed at the moving average
            var stock = materials.Keys.ToDictionary(k => k, _ => (Qty: 0m, Bought: 0m, Issued: 0m));
            var moves = Purchases.Select(p => (p.Day, Order: 0, p.Material, p.Qty, Rate: (decimal?)p.Rate, Project: (string?)null, Phase: 0))
                .Concat(Issues.Select(i => (i.Day, Order: 1, i.Material, i.Qty, Rate: (decimal?)null, Project: (string?)i.Project, Phase: i.Phase)))
                .OrderBy(m => m.Day).ThenBy(m => m.Order);
            foreach (var mv in moves)
            {
                var s = stock[mv.Material];
                var material = materials[mv.Material];
                if (mv.Rate != null)
                {
                    db.MaterialTransactions.Add(new MaterialTransaction
                    {
                        MaterialID = material.MaterialID, Type = "Restock", Quantity = mv.Qty, Rate = mv.Rate.Value,
                        Note = "Supplier delivery", CreatedAt = Day(mv.Day, 9)
                    });
                    stock[mv.Material] = (s.Qty + mv.Qty, s.Bought + mv.Qty * mv.Rate.Value, s.Issued);
                }
                else
                {
                    if (mv.Qty > s.Qty) throw new InvalidOperationException($"Demo data issues more {mv.Material} than is in stock.");
                    var value = Math.Max(0m, s.Bought - s.Issued);
                    var rate = Math.Round(s.Qty > 0 ? value / s.Qty : 0m, 2);
                    var project = projects[mv.Project!];
                    db.MaterialTransactions.Add(new MaterialTransaction
                    {
                        MaterialID = material.MaterialID, Type = "Issue", Quantity = mv.Qty, Rate = rate,
                        ProjectID = project.ProjectID, ProjectName = project.Title,
                        PhaseID = phases[(mv.Project!, mv.Phase)].PhaseID,
                        Note = "Issued to site", CreatedAt = Day(mv.Day, 14)
                    });
                    stock[mv.Material] = (s.Qty - mv.Qty, s.Bought, s.Issued + mv.Qty * rate);
                }
            }

            // Expenses
            var expenses = new Dictionary<string, ProjectExpense>();
            foreach (var e in Expenses)
            {
                var expense = new ProjectExpense
                {
                    ProjectID = projects[e.Project].ProjectID, PhaseID = phases[(e.Project, e.Phase)].PhaseID,
                    Category = e.Category, Description = e.Description, Amount = e.Amount, ExpenseDate = today.AddDays(e.Day),
                    PaidTo = e.PaidTo, IsRecoverable = e.Recoverable, CreatedByUserID = admin.UserID,
                    CreatedAt = Day(e.Day, 16), UpdatedAt = Day(e.Day, 16)
                };
                expenses[$"{e.Project}|{e.Description}"] = expense;
                db.ProjectExpenses.Add(expense);
            }

            // Assignments
            var assignments = new List<(AssignmentSeed Seed, Assignment Row)>();
            foreach (var a in Assignments)
            {
                var row = new Assignment
                {
                    EmployeeID = employees[a.Employee].EmployeeID, ProjectID = projects[a.Project].ProjectID,
                    Role = employees[a.Employee].Designation, WageType = a.WageType, WageAmount = a.Wage,
                    StartDate = today.AddDays(a.Start), EndDate = a.End == null ? null : today.AddDays(a.End.Value),
                    Status = a.End != null && a.End < 0 ? "Completed" : "Active",
                    CreatedAt = Day(a.Start - 1), UpdatedAt = Day(a.End ?? a.Start)
                };
                assignments.Add((a, row));
                db.Assignments.Add(row);
            }
            await db.SaveChangesAsync(ct);

            // Attendance for daily workers, up to yesterday. Absent days are spread evenly with a fixed
            // pattern, so every demo database gets the same marks. Today stays unmarked for the visitor.
            var marks = new List<Attendance>();
            for (int i = 0; i < assignments.Count; i++)
            {
                var (seed, row) = assignments[i];
                if (seed.WageType != "Daily") continue;
                var last = seed.End ?? -1;
                int k = 0;
                for (int offset = seed.Start; offset <= last; offset++)
                {
                    var date = today.AddDays(offset);
                    if (date.DayOfWeek == DayOfWeek.Sunday || holidays.Contains(date)) continue;
                    k++;
                    bool present = (k * 37 + (i + 1) * 11) % 100 < seed.PresentPercent;
                    marks.Add(new Attendance
                    {
                        AssignmentID = row.AssignmentID, Date = date, Status = present ? "Present" : "Absent",
                        CreatedAt = date.AddHours(18), UpdatedAt = date.AddHours(18)
                    });
                }
            }
            db.Attendances.AddRange(marks);
            await db.SaveChangesAsync(ct);

            // Salaries: every month before this one is paid in full, as the Salaries page works it out
            var rows = assignments.Select(x => x.Row).ToList();
            var presentByAssignment = marks.Where(m => m.Status == "Present")
                .GroupBy(m => m.AssignmentID).ToDictionary(g => g.Key, g => g.Select(m => m.Date).ToList());
            var thisMonth = new DateTime(today.Year, today.Month, 1);
            var firstMonth = new DateTime(rows.Min(r => r.StartDate).Year, rows.Min(r => r.StartDate).Month, 1);
            for (var month = firstMonth; month < thisMonth; month = month.AddMonths(1))
            {
                var monthEnd = month.AddMonths(1).AddDays(-1);
                var paidAt = month.AddMonths(1).AddDays(2).AddHours(11);
                if (paidAt > now) paidAt = now.AddHours(-1);

                foreach (var person in rows.Where(r => Overlaps(r, month, monthEnd)).GroupBy(r => r.EmployeeID))
                {
                    var monthly = person.Where(r => r.WageType == "Monthly").ToList();
                    if (monthly.Count > 0)
                        Pay(db, person.Key, month, "Monthly", null, null, MonthlyPay(monthly, month, monthEnd), admin.UserID, paidAt);

                    foreach (var r in person.Where(r => r.WageType == "Daily"))
                    {
                        var days = presentByAssignment.GetValueOrDefault(r.AssignmentID)?
                            .Count(d => d >= month && d <= monthEnd) ?? 0;
                        Pay(db, person.Key, month, "Daily", r.AssignmentID, r.ProjectID, days * r.WageAmount, admin.UserID, paidAt);
                    }

                    foreach (var r in person.Where(r => r.WageType == "Contract" && r.StartDate.Year == month.Year && r.StartDate.Month == month.Month))
                        Pay(db, person.Key, month, "Contract", r.AssignmentID, r.ProjectID, r.WageAmount, admin.UserID, paidAt);
                }
            }

            // Invoices, numbered in the order they were issued
            int seq = 0;
            foreach (var inv in Invoices.OrderBy(i => i.Issued))
            {
                var project = projects[inv.Project];
                var invoice = new Invoice
                {
                    InvoiceNumber = $"{CompanyOptions.DefaultInvoicePrefix}-{++seq:0000}",
                    ProjectID = project.ProjectID, IssueDate = today.AddDays(inv.Issued), DueDate = today.AddDays(inv.Due),
                    TaxAmount = 0, Notes = inv.Notes, CreatedAt = Day(inv.Issued, 12)
                };
                db.Invoices.Add(invoice);
                await db.SaveChangesAsync(ct);

                decimal total = 0;
                foreach (var line in inv.Lines)
                {
                    var expense = line.Expense == null ? null : expenses[$"{inv.Project}|{line.Expense}"];
                    var amount = expense?.Amount ?? Math.Round(project.Budget * (line.Share ?? 0m), 2);
                    total += amount;
                    db.InvoiceItems.Add(new InvoiceItem
                    {
                        InvoiceID = invoice.InvoiceID, Description = line.Text, Quantity = 1, Rate = amount, Amount = amount,
                        PhaseID = phases[(inv.Project, line.Phase)].PhaseID, ExpenseID = expense?.ExpenseID
                    });
                }

                decimal paid = 0;
                int n = 0;
                foreach (var payment in inv.Payments)
                {
                    n++;
                    var amount = payment.Amount ?? total - paid;
                    paid += amount;
                    db.InvoicePayments.Add(new InvoicePayment
                    {
                        InvoiceID = invoice.InvoiceID, Amount = amount, PaymentDate = today.AddDays(payment.Day),
                        Method = payment.Method,
                        Reference = payment.Method == "Cheque" ? $"CHQ-{4500 + seq * 7 + n}" : $"TRX-{760000 + seq * 131 + n}",
                        CreatedAt = Day(payment.Day, 15)
                    });
                }
            }

            // Material requests from the Site Engineer
            var users = new Dictionary<string, User> { ["admin"] = admin, ["manager"] = manager };
            foreach (var r in Requests)
            {
                db.MaterialRequests.Add(new MaterialRequest
                {
                    ProjectID = projects[r.Project].ProjectID, PhaseID = phases[(r.Project, r.Phase)].PhaseID,
                    MaterialID = materials[r.Material].MaterialID, Quantity = r.Qty, Note = r.Note,
                    RequestedByUserID = engineer.UserID, Status = r.Status,
                    ResolvedByUserID = r.ResolvedBy == null ? null : users[r.ResolvedBy].UserID,
                    ResolveNote = r.ResolveNote,
                    CreatedAt = now.AddDays(r.Day),
                    ResolvedAt = r.ResolvedDay == null ? null : Day(r.ResolvedDay.Value, 11)
                });
            }

            // Messages from the website contact form
            foreach (var q in Inquiries)
            {
                db.Inquiries.Add(new Inquiry
                {
                    Name = q.Name, Phone = q.Phone, Email = q.Email, Service = q.Service, Message = q.Message,
                    IsRead = q.Read, CreatedAt = now.AddDays(q.Day)
                });
            }

            await db.SaveChangesAsync(ct);
        }

        private static void Pay(AppDbContext db, int employeeId, DateTime month, string type, int? assignmentId, int? projectId,
            decimal amount, int paidBy, DateTime paidAt)
        {
            if (amount <= 0) return;
            db.SalaryPayments.Add(new SalaryPayment
            {
                EmployeeID = employeeId, Year = month.Year, Month = month.Month, SourceType = type,
                AssignmentID = assignmentId, ProjectID = projectId, CalculatedAmount = amount, PaidAmount = amount,
                PaidByUserID = paidBy, PaidAt = paidAt, CreatedAt = paidAt
            });
        }

        private static bool Overlaps(Assignment a, DateTime from, DateTime to) =>
            a.StartDate.Date <= to && (a.EndDate == null || a.EndDate.Value.Date >= from);

        // The same rule as the Salaries page: each day earns 1/days-in-month of the wage of the
        // monthly assignment running that day (the latest one if several overlap).
        private static decimal MonthlyPay(List<Assignment> monthly, DateTime monthStart, DateTime monthEnd)
        {
            var latestFirst = monthly.OrderByDescending(a => a.StartDate).ThenByDescending(a => a.AssignmentID).ToList();
            int days = DateTime.DaysInMonth(monthStart.Year, monthStart.Month);
            decimal total = 0m;
            for (var d = monthStart; d <= monthEnd; d = d.AddDays(1))
            {
                var running = latestFirst.FirstOrDefault(a => d >= a.StartDate.Date && (a.EndDate == null || d <= a.EndDate.Value.Date));
                if (running != null) total += running.WageAmount;
            }
            return Math.Round(total / days, 2);
        }
    }
}
