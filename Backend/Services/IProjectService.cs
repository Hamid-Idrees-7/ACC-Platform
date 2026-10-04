using Backend.Models.DTOs;

namespace Backend.Services
{
    public interface IProjectService
    {
        Task<List<ProjectDto>> GetAllProjectsAsync();
        Task<ProjectDetailDto?> GetProjectDetailAsync(int id);
        Task<List<ProjectPhaseDto>> GetPhaseListAsync(int projectId);
        Task<ProjectDto> CreateProjectAsync(CreateProjectDto dto);
        Task<ProjectDto?> UpdateProjectAsync(int id, CreateProjectDto dto);
        Task<bool> DeleteProjectAsync(int id);
        Task<string?> GetDeleteBlockerAsync(int id);
        Task<ProjectStatusResult> ChangeStatusAsync(int id, string status);
        Task<string?> CheckAsync(CreateProjectDto dto, int? id);

        Task<ProjectPhaseDto?> AddPhaseAsync(int projectId, CreatePhaseDto dto);
        Task<ProjectPhaseDto?> UpdatePhaseAsync(int phaseId, UpdatePhaseDto dto);
        Task<PhaseSummary?> DescribePhaseAsync(int phaseId);
        Task<bool> DeletePhaseAsync(int phaseId);
        Task<string?> GetPhaseDeleteBlockerAsync(int phaseId);
        Task ReorderPhasesAsync(int projectId, List<int> phaseIds);
    }

    public record PhaseSummary(int ProjectID, string ProjectTitle, string PhaseName, int Progress, string Status);

    // Project is null when it wasn't found or Error says why the change was refused.
    // EndedAssignments and ClosedRequests count what closing the project ended.
    public record ProjectStatusResult(ProjectDetailDto? Project, string? Error, int EndedAssignments, int ClosedRequests);
}
