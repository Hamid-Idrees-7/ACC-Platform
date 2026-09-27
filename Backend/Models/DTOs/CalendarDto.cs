namespace Backend.Models.DTOs
{
    // Settings > Calendar: the weekly off days and the company holidays.
    public class CalendarDto
    {
        // In week order, eg ["Friday", "Sunday"]. Empty = no weekly off.
        public List<string> WeeklyOffDays { get; set; } = new();
        public List<HolidayDto> Holidays { get; set; } = new();
    }

    public class HolidayDto
    {
        public int HolidayID { get; set; }
        public string Name { get; set; } = string.Empty;
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
        public int Days { get; set; }
    }

    // Add or edit a holiday. EndDate may be left empty for a one-day holiday.
    public class SaveHolidayDto
    {
        public string? Name { get; set; }
        public DateTime? StartDate { get; set; }
        public DateTime? EndDate { get; set; }
    }

    public class SaveWeeklyOffDto
    {
        public List<string>? Days { get; set; }
    }
}
