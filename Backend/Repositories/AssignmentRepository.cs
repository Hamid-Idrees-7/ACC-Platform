using Backend.Data;
using Backend.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace Backend.Repositories
{
    public class AssignmentRepository : IAssignmentRepository
    {
        private readonly AppDbContext _context;

        public AssignmentRepository(AppDbContext context)
        {
            _context = context;
        }

        public async Task<List<Assignment>> GetAllAsync()
        {
            return await _context.Assignments
                .OrderByDescending(a => a.AssignmentID)
                .ToListAsync();
        }

        public async Task<Assignment?> GetByIdAsync(int id)
        {
            return await _context.Assignments.FindAsync(id);
        }

        public async Task<Assignment> AddAsync(Assignment assignment)
        {
            _context.Assignments.Add(assignment);
            await _context.SaveChangesAsync();
            return assignment;
        }

        public async Task UpdateAsync(Assignment assignment)
        {
            _context.Assignments.Update(assignment);
            await _context.SaveChangesAsync();
        }

        public async Task<bool> DeleteAsync(int id)
        {
            var assignment = await _context.Assignments.FindAsync(id);
            if (assignment == null) return false;

            _context.Assignments.Remove(assignment);
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<List<Assignment>> GetByProjectAsync(int projectId)
        {
            return await _context.Assignments
                .Where(a => a.ProjectID == projectId)
                .OrderByDescending(a => a.AssignmentID)
                .ToListAsync();
        }

        public async Task<List<Assignment>> GetByEmployeeAsync(int employeeId)
        {
            return await _context.Assignments
                .Where(a => a.EmployeeID == employeeId)
                .ToListAsync();
        }

        public async Task<bool> AnyForEmployeeAsync(int employeeId)
        {
            return await _context.Assignments.AnyAsync(a => a.EmployeeID == employeeId);
        }
    }
}
