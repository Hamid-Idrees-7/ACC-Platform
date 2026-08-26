using Backend.Models.DTOs;

namespace Backend.Services
{
    public interface IAttendanceService
    {
        // Cards for the list page — every project with its site incharge and worker count.
        Task<List<AttendanceProjectCardDto>> GetProjectCardsAsync();

        // The mark-attendance sheet for one project on one date (null if project missing).
        Task<AttendanceSheetDto?> GetSheetAsync(int projectId, DateTime date);

        // Save the marked rows for a project + date, then return the refreshed sheet.
        Task<AttendanceSheetDto?> SaveAsync(int projectId, MarkAttendanceDto dto);
    }
}
