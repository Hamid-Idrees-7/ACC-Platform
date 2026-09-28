using Backend.Alerts;
using Backend.Data;
using Backend.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace Backend.Repositories
{
    public class AlertRepository : IAlertRepository
    {
        private readonly AppDbContext _context;

        public AlertRepository(AppDbContext context)
        {
            _context = context;
        }

        public string DatabaseName => _context.Database.GetDbConnection().Database;

        public async Task<AlertFacts> LoadFactsAsync(DateTime now)
        {
            var attendanceFrom = now.Date.AddDays(-60);
            var settings = await _context.CompanySettings.AsNoTracking().FirstOrDefaultAsync();

            return new AlertFacts
            {
                Now = now,
                Projects = await _context.Projects.AsNoTracking().ToListAsync(),
                Phases = await _context.ProjectPhases.AsNoTracking().ToListAsync(),
                Expenses = await _context.ProjectExpenses.AsNoTracking().ToListAsync(),
                Invoices = await _context.Invoices.AsNoTracking().ToListAsync(),
                InvoiceItems = await _context.InvoiceItems.AsNoTracking().ToListAsync(),
                InvoicePayments = await _context.InvoicePayments.AsNoTracking().ToListAsync(),
                Materials = await _context.Materials.AsNoTracking().ToListAsync(),
                MaterialTransactions = await _context.MaterialTransactions.AsNoTracking()
                    .Where(t => !t.IsCancelled)
                    .ToListAsync(),
                PendingMaterialRequests = await _context.MaterialRequests.AsNoTracking()
                    .Where(r => r.Status == "Pending")
                    .ToListAsync(),
                PendingApprovals = await _context.PendingActions.AsNoTracking()
                    .Where(a => a.Status == "Pending")
                    .ToListAsync(),
                UnreadInquiries = await _context.Inquiries.AsNoTracking()
                    .Where(i => !i.IsRead)
                    .ToListAsync(),
                Assignments = await _context.Assignments.AsNoTracking().ToListAsync(),
                Attendance = await _context.Attendances.AsNoTracking()
                    .Where(a => a.Date >= attendanceFrom)
                    .ToListAsync(),
                PresentDays = await _context.Attendances.AsNoTracking()
                    .Where(a => a.Status == "Present")
                    .GroupBy(a => a.AssignmentID)
                    .Select(g => new { g.Key, Count = g.Count() })
                    .ToDictionaryAsync(x => x.Key, x => x.Count),
                Employees = await _context.Employees.AsNoTracking().ToListAsync(),
                Holidays = await _context.CompanyHolidays.AsNoTracking().ToListAsync(),
                WeeklyOffDays = CompanyOptions.SplitDays(settings?.WeeklyOffDays ?? CompanyOptions.DefaultWeeklyOff)
            };
        }

        public async Task<List<Alert>> GetOpenAsync()
        {
            return await _context.Alerts
                .Where(a => a.Status == AlertStatuses.Open)
                .OrderByDescending(a => a.AlertID)
                .ToListAsync();
        }

        public async Task<List<Alert>> GetResolvedSinceAsync(DateTime since)
        {
            return await _context.Alerts.AsNoTracking()
                .Where(a => a.Status == AlertStatuses.Resolved && a.ResolvedAt >= since)
                .OrderByDescending(a => a.ResolvedAt)
                .ToListAsync();
        }

        public async Task<Alert?> GetAsync(int id)
        {
            return await _context.Alerts.FirstOrDefaultAsync(a => a.AlertID == id);
        }

        public async Task AddAsync(Alert alert)
        {
            _context.Alerts.Add(alert);
            await _context.SaveChangesAsync();
        }

        public async Task UpdateAsync(Alert alert)
        {
            _context.Alerts.Update(alert);
            await _context.SaveChangesAsync();
        }

        public async Task ApplyAsync(AlertChanges changes, DateTime purgeResolvedBefore)
        {
            if (changes.Any)
            {
                foreach (var alert in changes.Added) _context.Alerts.Add(alert);
                _context.Alerts.RemoveRange(changes.Removed);
                await _context.SaveChangesAsync();
            }

            await _context.Alerts
                .Where(a => a.Status == AlertStatuses.Resolved && a.ResolvedAt < purgeResolvedBefore)
                .ExecuteDeleteAsync();
        }

        public async Task<List<AlertRule>> GetRulesAsync()
        {
            return await _context.AlertRules.AsNoTracking().ToListAsync();
        }

        public async Task<AlertRule?> GetRuleAsync(string type)
        {
            return await _context.AlertRules.FirstOrDefaultAsync(r => r.Type == type);
        }

        public async Task SaveRuleAsync(AlertRule rule)
        {
            if (_context.Entry(rule).State == EntityState.Detached)
                _context.AlertRules.Add(rule);
            await _context.SaveChangesAsync();
        }
    }
}
