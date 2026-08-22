using Backend.Data;
using Backend.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace Backend.Repositories
{
    public class ProjectRepository : IProjectRepository
    {
        private readonly AppDbContext _context;

        public ProjectRepository(AppDbContext context)
        {
            _context = context;
        }

        public async Task<List<Project>> GetAllAsync()
        {
            return await _context.Projects
                .OrderByDescending(p => p.ProjectID)
                .ToListAsync();
        }

        public async Task<Project?> GetByIdAsync(int id)
        {
            return await _context.Projects.FindAsync(id);
        }

        public async Task<Project> AddAsync(Project project)
        {
            _context.Projects.Add(project);
            await _context.SaveChangesAsync();
            return project;
        }

        public async Task UpdateAsync(Project project)
        {
            _context.Projects.Update(project);
            await _context.SaveChangesAsync();
        }

        public async Task<bool> DeleteAsync(int id)
        {
            var project = await _context.Projects.FindAsync(id);
            if (project == null) return false;

            // The FK cascade removes this project's phases with it.
            _context.Projects.Remove(project);
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<bool> AnyForClientAsync(int clientId)
        {
            return await _context.Projects.AnyAsync(p => p.ClientID == clientId);
        }

        public async Task<List<ProjectPhase>> GetAllPhasesAsync()
        {
            return await _context.ProjectPhases.ToListAsync();
        }

        public async Task<List<ProjectPhase>> GetPhasesAsync(int projectId)
        {
            return await _context.ProjectPhases
                .Where(p => p.ProjectID == projectId)
                .OrderBy(p => p.OrderNo)
                .ToListAsync();
        }

        public async Task<ProjectPhase?> GetPhaseByIdAsync(int phaseId)
        {
            return await _context.ProjectPhases.FindAsync(phaseId);
        }

        public async Task AddPhaseAsync(ProjectPhase phase)
        {
            _context.ProjectPhases.Add(phase);
            await _context.SaveChangesAsync();
        }

        public async Task AddPhasesAsync(List<ProjectPhase> phases)
        {
            _context.ProjectPhases.AddRange(phases);
            await _context.SaveChangesAsync();
        }

        public async Task UpdatePhaseAsync(ProjectPhase phase)
        {
            _context.ProjectPhases.Update(phase);
            await _context.SaveChangesAsync();
        }

        public async Task UpdatePhasesAsync(List<ProjectPhase> phases)
        {
            _context.ProjectPhases.UpdateRange(phases);
            await _context.SaveChangesAsync();
        }

        public async Task<bool> DeletePhaseAsync(int phaseId)
        {
            var phase = await _context.ProjectPhases.FindAsync(phaseId);
            if (phase == null) return false;

            _context.ProjectPhases.Remove(phase);
            await _context.SaveChangesAsync();
            return true;
        }
    }
}
