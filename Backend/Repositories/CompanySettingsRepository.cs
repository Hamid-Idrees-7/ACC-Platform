using Backend.Data;
using Backend.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace Backend.Repositories
{
    public class CompanySettingsRepository : ICompanySettingsRepository
    {
        private readonly AppDbContext _context;

        public CompanySettingsRepository(AppDbContext context)
        {
            _context = context;
        }

        public async Task<CompanySetting?> GetAsync()
        {
            return await _context.CompanySettings
                .AsNoTracking()
                .FirstOrDefaultAsync(s => s.CompanySettingID == CompanyOptions.RowId);
        }

        public async Task SaveAsync(CompanySetting settings)
        {
            settings.CompanySettingID = CompanyOptions.RowId;
            var existing = await _context.CompanySettings.FindAsync(CompanyOptions.RowId);
            if (existing == null)
            {
                _context.CompanySettings.Add(settings);
            }
            else
            {
                // The invoice counter is not part of the settings form.
                settings.LastInvoiceSeq = existing.LastInvoiceSeq;
                _context.Entry(existing).CurrentValues.SetValues(settings);
            }
            await _context.SaveChangesAsync();
        }

        public async Task<int> ReserveInvoiceSeqAsync(int atLeast)
        {
            var row = await _context.CompanySettings.FindAsync(CompanyOptions.RowId);
            if (row == null)
            {
                // First invoice before the settings were ever saved: the row starts with the defaults.
                row = new CompanySetting { UpdatedBy = null };
                _context.CompanySettings.Add(row);
            }
            row.LastInvoiceSeq = Math.Max(row.LastInvoiceSeq, atLeast) + 1;
            await _context.SaveChangesAsync();
            return row.LastInvoiceSeq;
        }

        public string DatabaseName => _context.Database.GetDbConnection().Database;

        public async Task SaveWeeklyOffAsync(string days)
        {
            var existing = await _context.CompanySettings.FindAsync(CompanyOptions.RowId);
            if (existing == null)
            {
                // First change ever: the rest of the row keeps its defaults.
                _context.CompanySettings.Add(new CompanySetting { WeeklyOffDays = days });
            }
            else
            {
                existing.WeeklyOffDays = days;
            }
            await _context.SaveChangesAsync();
        }
    }
}
