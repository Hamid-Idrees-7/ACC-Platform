using Backend.Models.DTOs;

namespace Backend.Services
{
    // Field View — the scoped experience for a site engineer. Every method takes the
    // caller's userId and only ever returns/accepts data for projects that user is
    // actually assigned to. Scoping is enforced here (server-side), not in the UI.
    public interface IFieldService
    {
        // The engineer's own sites + today's attendance snapshot.
        Task<FieldSiteDto> GetMySiteAsync(int userId);

        // The attendance sheet for one of the engineer's own projects. Null if the
        // project isn't theirs (or doesn't exist).
        Task<AttendanceSheetDto?> GetSheetAsync(int userId, int projectId, DateTime date);

        // Mark attendance for one of the engineer's own projects. Null if not theirs.
        Task<AttendanceSheetDto?> MarkAttendanceAsync(int userId, int projectId, MarkAttendanceDto dto);

        // The phases of one of the engineer's own projects. Null if not theirs.
        Task<List<ProjectPhaseDto>?> GetPhasesAsync(int userId, int projectId);

        // Update one phase's progress on the engineer's own project. Returns the refreshed
        // phase list, or null if the project/phase isn't theirs.
        Task<List<ProjectPhaseDto>?> UpdateProgressAsync(int userId, int projectId, FieldProgressDto dto);

        // Material request flow (engineer side). Create returns the new request, or an
        // error message if the site/material/phase/quantity fails validation.
        Task<FieldRequestOptionsDto?> GetRequestOptionsAsync(int userId, int projectId);
        Task<(MaterialRequestDto? Request, string? Error)> CreateRequestAsync(int userId, int projectId, CreateMaterialRequestDto dto);
        Task<List<MaterialRequestDto>> GetMyRequestsAsync(int userId);

        // Non-financial site details for the engineer (no budget/cost/profit).
        Task<FieldSiteInfoDto?> GetSiteInfoAsync(int userId, int projectId);

        // Cancel the engineer's own still-pending request.
        Task<(bool Success, string? Error)> DeleteRequestAsync(int userId, int requestId);
    }
}
