using Backend.Data;
using Backend.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace Backend.Repositories
{
    public class CalendarRepository : ICalendarRepository
    {
        private readonly AppDbContext _context;

        public CalendarRepository(AppDbContext context)
        {
            _context = context;
        }

        public async Task<List<CompanyHoliday>> GetHolidaysAsync()
        {
            return await _context.CompanyHolidays
                .AsNoTracking()
                .OrderBy(h => h.StartDate)
                .ToListAsync();
        }

        public async Task<CompanyHoliday?> GetHolidayAsync(int id)
        {
            return await _context.CompanyHolidays.FindAsync(id);
        }

        public async Task<CompanyHoliday?> FindOverlapAsync(DateTime start, DateTime end, int? exceptId)
        {
            return await _context.CompanyHolidays
                .AsNoTracking()
                .Where(h => h.HolidayID != (exceptId ?? 0) && h.StartDate <= end && h.EndDate >= start)
                .OrderBy(h => h.StartDate)
                .FirstOrDefaultAsync();
        }

        public async Task<CompanyHoliday> AddHolidayAsync(CompanyHoliday holiday)
        {
            _context.CompanyHolidays.Add(holiday);
            await _context.SaveChangesAsync();
            return holiday;
        }

        public async Task UpdateHolidayAsync(CompanyHoliday holiday)
        {
            _context.CompanyHolidays.Update(holiday);
            await _context.SaveChangesAsync();
        }

        public async Task<bool> DeleteHolidayAsync(int id)
        {
            var holiday = await _context.CompanyHolidays.FindAsync(id);
            if (holiday == null) return false;
            _context.CompanyHolidays.Remove(holiday);
            await _context.SaveChangesAsync();
            return true;
        }
    }
}
