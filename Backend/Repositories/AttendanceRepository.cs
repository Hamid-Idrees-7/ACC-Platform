using Backend.Data;
using Backend.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace Backend.Repositories
{
    public class AttendanceRepository : IAttendanceRepository
    {
        private readonly AppDbContext _context;

        public AttendanceRepository(AppDbContext context)
        {
            _context = context;
        }

        public async Task<List<Attendance>> GetByAssignmentIdsAsync(List<int> assignmentIds)
        {
            if (assignmentIds.Count == 0) return new List<Attendance>();

            return await _context.Attendances
                .Where(a => assignmentIds.Contains(a.AssignmentID))
                .ToListAsync();
        }

        public async Task<Attendance?> GetByAssignmentAndDateAsync(int assignmentId, DateTime date)
        {
            var day = date.Date;
            return await _context.Attendances
                .FirstOrDefaultAsync(a => a.AssignmentID == assignmentId && a.Date == day);
        }

        public async Task AddAsync(Attendance attendance)
        {
            _context.Attendances.Add(attendance);
            await _context.SaveChangesAsync();
        }

        public async Task<bool> TryAddAsync(Attendance attendance)
        {
            _context.Attendances.Add(attendance);
            try
            {
                await _context.SaveChangesAsync();
                return true;
            }
            catch (DbUpdateException)
            {
                // The unique (assignment, date) index: someone saved this day first.
                _context.Entry(attendance).State = EntityState.Detached;
                return false;
            }
        }

        public async Task<(DateTime First, DateTime Last)?> GetDateRangeAsync(int assignmentId)
        {
            var range = await _context.Attendances
                .Where(a => a.AssignmentID == assignmentId)
                .GroupBy(a => a.AssignmentID)
                .Select(g => new { First = g.Min(a => a.Date), Last = g.Max(a => a.Date) })
                .FirstOrDefaultAsync();
            return range == null ? null : (range.First, range.Last);
        }

        public async Task UpdateAsync(Attendance attendance)
        {
            _context.Attendances.Update(attendance);
            await _context.SaveChangesAsync();
        }

        public async Task<Dictionary<int, int>> GetPresentDayCountsAsync(List<int> assignmentIds)
        {
            if (assignmentIds.Count == 0) return new Dictionary<int, int>();

            return await _context.Attendances
                .Where(a => assignmentIds.Contains(a.AssignmentID) && a.Status == "Present")
                .GroupBy(a => a.AssignmentID)
                .Select(g => new { g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.Key, x => x.Count);
        }
    }
}
