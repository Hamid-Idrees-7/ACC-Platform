using Backend.Models.Entities;

namespace Backend.Repositories
{
    public interface IAttendanceRepository
    {
        // All attendance rows for a set of assignments (used to build timelines
        // and to read the selected date's status in memory)
        Task<List<Attendance>> GetByAssignmentIdsAsync(List<int> assignmentIds);

        // A single assignment's record for one date — used to upsert
        Task<Attendance?> GetByAssignmentAndDateAsync(int assignmentId, DateTime date);

        Task AddAsync(Attendance attendance);
        Task UpdateAsync(Attendance attendance);

        // Present-day count per assignment (daily labour = present days x wage)
        Task<Dictionary<int, int>> GetPresentDayCountsAsync(List<int> assignmentIds);
    }
}
