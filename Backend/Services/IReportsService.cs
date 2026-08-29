using Backend.Models.DTOs;

namespace Backend.Services
{
    public interface IReportsService
    {
        // Builds the full company report (financial, projects, materials, workforce).
        Task<ReportsDto> GetReportsAsync();
    }
}
