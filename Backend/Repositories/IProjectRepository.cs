using Backend.Models.Entities;

namespace Backend.Repositories
{
    public interface IProjectRepository
    {
        Task<List<Project>> GetAllAsync();
        Task<Project?> GetByIdAsync(int id);
        Task<Project> AddAsync(Project project);
        Task UpdateAsync(Project project);
        Task<bool> DeleteAsync(int id);
        Task<bool> AnyForClientAsync(int clientId);

        Task<List<ProjectPhase>> GetAllPhasesAsync();
        Task<List<ProjectPhase>> GetPhasesAsync(int projectId);
        Task<ProjectPhase?> GetPhaseByIdAsync(int phaseId);
        Task AddPhaseAsync(ProjectPhase phase);
        Task AddPhasesAsync(List<ProjectPhase> phases);
        Task UpdatePhaseAsync(ProjectPhase phase);
        Task UpdatePhasesAsync(List<ProjectPhase> phases);
        Task<bool> DeletePhaseAsync(int phaseId);
    }
}
