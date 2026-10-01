using Backend.Models.DTOs;

namespace Backend.Services
{
    public interface IAttendanceService
    {
        // Cards for the list page: every project with its site incharge and worker count.
        Task<List<AttendanceProjectCardDto>> GetProjectCardsAsync();

        // The mark-attendance sheet for one project on one date (null if project missing).
        Task<AttendanceSheetDto?> GetSheetAsync(int projectId, DateTime date);

        // Saves the marked rows for a project and date, then returns the refreshed sheet.
        Task<AttendanceSheetDto?> SaveAsync(int projectId, MarkAttendanceDto dto);
    }
}
