using Backend.Models.Entities;

namespace Backend.Repositories
{
    public interface ICalendarRepository
    {
        Task<List<CompanyHoliday>> GetHolidaysAsync();
        Task<CompanyHoliday?> GetHolidayAsync(int id);

        // A holiday that shares at least one day with the given dates (ignoring one, for edits).
        Task<CompanyHoliday?> FindOverlapAsync(DateTime start, DateTime end, int? exceptId);

        Task<CompanyHoliday> AddHolidayAsync(CompanyHoliday holiday);
        Task UpdateHolidayAsync(CompanyHoliday holiday);
        Task<bool> DeleteHolidayAsync(int id);
    }
}
