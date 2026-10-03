using Backend.Models.Entities;

namespace Backend.Repositories
{
    public interface IAttendanceRepository
    {
        // All attendance rows for a set of assignments (used to build timelines
        // and to read the selected date's status in memory)
        Task<List<Attendance>> GetByAssignmentIdsAsync(List<int> assignmentIds);

        // One assignment's record for one date, used for the upsert
        Task<Attendance?> GetByAssignmentAndDateAsync(int assignmentId, DateTime date);

        Task AddAsync(Attendance attendance);

        // Adds the row unless the same assignment already has one for that day (saved by someone
        // else at the same moment); returns false then, so the caller updates it instead.
        Task<bool> TryAddAsync(Attendance attendance);

        // First and last marked day of an assignment, or null when it has none
        Task<(DateTime First, DateTime Last)?> GetDateRangeAsync(int assignmentId);
        Task UpdateAsync(Attendance attendance);

        // Present-day count per assignment (daily labour = present days x wage)
        Task<Dictionary<int, int>> GetPresentDayCountsAsync(List<int> assignmentIds);
    }
}
