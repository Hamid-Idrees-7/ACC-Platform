using Backend.Models.DTOs;

namespace Backend.Services
{
    public interface ICalendarService
    {
        // Weekly off days and holidays (everyone signed in can read them).
        Task<CalendarDto> GetAsync();

        // Admin only. Each returns the whole calendar again, or an error and its field.
        Task<(CalendarDto? Calendar, string? Error, string? Field)> SaveWeeklyOffAsync(SaveWeeklyOffDto dto);
        Task<(CalendarDto? Calendar, string? Error, string? Field)> AddHolidayAsync(SaveHolidayDto dto, string? createdBy);
        Task<(CalendarDto? Calendar, string? Error, string? Field)> UpdateHolidayAsync(int id, SaveHolidayDto dto);

        // Null when the holiday does not exist.
        Task<CalendarDto?> DeleteHolidayAsync(int id);
    }
}
