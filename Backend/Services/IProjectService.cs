using Backend.Models.DTOs;

namespace Backend.Services
{
    public interface IProjectService
    {
        Task<List<ProjectDto>> GetAllProjectsAsync();
        Task<ProjectDetailDto?> GetProjectDetailAsync(int id);
        Task<ProjectDto> CreateProjectAsync(CreateProjectDto dto);
        Task<ProjectDto?> UpdateProjectAsync(int id, CreateProjectDto dto);
        Task<bool> DeleteProjectAsync(int id);
        Task<string?> GetDeleteBlockerAsync(int id);
        Task<ProjectDetailDto?> ChangeStatusAsync(int id, string status);

        Task<ProjectPhaseDto?> AddPhaseAsync(int projectId, CreatePhaseDto dto);
        Task<ProjectPhaseDto?> UpdatePhaseAsync(int phaseId, UpdatePhaseDto dto);
        Task<bool> DeletePhaseAsync(int phaseId);
        Task ReorderPhasesAsync(int projectId, List<int> phaseIds);
    }
}
