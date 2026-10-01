using System.Text.RegularExpressions;
using Backend.Models.DTOs;
using Backend.Models.Entities;
using Backend.Repositories;

namespace Backend.Services
{
    // Settings > Calendar: weekly off days (eg Sunday, or Friday and Sunday) and company
    // holidays of one or more days (eg Eid ul Adha, 3 days). Attendance marks these days off.
    public class CalendarService : ICalendarService
    {
        // Longest single holiday allowed, to catch a mistyped year or month
        private const int MaxHolidayDays = 31;

        private readonly ICalendarRepository _repository;
        private readonly ICompanySettingsRepository _companyRepository;

        public CalendarService(ICalendarRepository repository, ICompanySettingsRepository companyRepository)
        {
            _repository = repository;
            _companyRepository = companyRepository;
        }

        public async Task<CalendarDto> GetAsync()
        {
            var settings = await _companyRepository.GetAsync();
            var holidays = await _repository.GetHolidaysAsync();
            return new CalendarDto
            {
                WeeklyOffDays = CompanyOptions.SplitDays(settings?.WeeklyOffDays ?? CompanyOptions.DefaultWeeklyOff),
                Holidays = holidays.Select(ToDto).ToList()
            };
        }

        public async Task<(CalendarDto? Calendar, string? Error, string? Field)> SaveWeeklyOffAsync(SaveWeeklyOffDto dto)
        {
            var chosen = (dto.Days ?? new List<string>()).Select(d => d?.Trim() ?? "").ToList();
            var unknown = chosen.FirstOrDefault(d => !CompanyOptions.WeekDays.Contains(d, StringComparer.OrdinalIgnoreCase));
            if (unknown != null) return (null, "Choose days of the week from the list.", "weeklyOff");

            // Stored in week order, without repeats
            var days = CompanyOptions.WeekDays
                .Where(w => chosen.Contains(w, StringComparer.OrdinalIgnoreCase))
                .ToList();
            if (days.Count == CompanyOptions.WeekDays.Length)
                return (null, "At least one day of the week must be a working day.", "weeklyOff");

            await _companyRepository.SaveWeeklyOffAsync(string.Join(",", days));
            return (await GetAsync(), null, null);
        }

        public async Task<(CalendarDto? Calendar, string? Error, string? Field)> AddHolidayAsync(SaveHolidayDto dto, string? createdBy)
        {
            var (clean, error, field) = await ValidateAsync(dto, null);
            if (error != null) return (null, error, field);

            clean!.CreatedAt = DateTime.Now;
            clean.CreatedBy = string.IsNullOrWhiteSpace(createdBy) ? null : createdBy.Trim();
            await _repository.AddHolidayAsync(clean);
            return (await GetAsync(), null, null);
        }

        public async Task<(CalendarDto? Calendar, string? Error, string? Field)> UpdateHolidayAsync(int id, SaveHolidayDto dto)
        {
            var existing = await _repository.GetHolidayAsync(id);
            if (existing == null) return (null, "This holiday no longer exists.", null);

            var (clean, error, field) = await ValidateAsync(dto, id);
            if (error != null) return (null, error, field);

            existing.Name = clean!.Name;
            existing.StartDate = clean.StartDate;
            existing.EndDate = clean.EndDate;
            await _repository.UpdateHolidayAsync(existing);
            return (await GetAsync(), null, null);
        }

        public async Task<CalendarDto?> DeleteHolidayAsync(int id)
        {
            if (!await _repository.DeleteHolidayAsync(id)) return null;
            return await GetAsync();
        }

        private async Task<(CompanyHoliday? Clean, string? Error, string? Field)> ValidateAsync(SaveHolidayDto dto, int? exceptId)
        {
            var name = string.IsNullOrWhiteSpace(dto.Name) ? "" : Regex.Replace(dto.Name.Trim(), @"\s+", " ");
            if (name.Length < 2) return (null, "Enter the holiday name, eg Eid ul Fitr.", "name");
            if (name.Length > 60) return (null, "The name can be at most 60 characters.", "name");
            if (!Regex.IsMatch(name, @"\p{L}")) return (null, "The name must contain letters.", "name");

            if (dto.StartDate == null) return (null, "Choose the first day of the holiday.", "startDate");
            var start = dto.StartDate.Value.Date;
            var end = (dto.EndDate ?? dto.StartDate).Value.Date;

            if (start.Year < 2000 || start.Year > 2100) return (null, "Choose a date between 2000 and 2100.", "startDate");
            if (end < start) return (null, "The last day can't be before the first day.", "endDate");
            if ((end - start).TotalDays + 1 > MaxHolidayDays)
                return (null, $"A holiday can be at most {MaxHolidayDays} days long.", "endDate");

            var overlap = await _repository.FindOverlapAsync(start, end, exceptId);
            if (overlap != null)
                return (null, $"These dates overlap \"{overlap.Name}\" ({overlap.StartDate:d MMM yyyy}" +
                              (overlap.EndDate > overlap.StartDate ? $" to {overlap.EndDate:d MMM yyyy}" : "") + ").", "startDate");

            return (new CompanyHoliday { Name = name, StartDate = start, EndDate = end }, null, null);
        }

        private static HolidayDto ToDto(CompanyHoliday h) => new()
        {
            HolidayID = h.HolidayID,
            Name = h.Name,
            StartDate = h.StartDate,
            EndDate = h.EndDate,
            Days = (int)(h.EndDate - h.StartDate).TotalDays + 1
        };
    }
}
