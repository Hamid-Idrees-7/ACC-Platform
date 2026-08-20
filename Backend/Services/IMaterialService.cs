using Backend.Models.DTOs;

namespace Backend.Services
{
    public interface IMaterialService
    {
        Task<List<MaterialDto>> GetAllMaterialsAsync();
        Task<MaterialDto?> GetMaterialByIdAsync(int id);
        Task<MaterialDto> CreateMaterialAsync(CreateMaterialDto dto);
        Task<MaterialDto?> UpdateMaterialAsync(int id, CreateMaterialDto dto);
        Task<bool> DeleteMaterialAsync(int id);
        Task<StockResult> RestockAsync(int id, RestockDto dto);
        Task<StockResult> IssueAsync(int id, IssueDto dto);
        Task<MaterialHistoryDto?> GetHistoryAsync(int id);
    }

    // Outcome of a restock/issue: either the updated material, or a reason it failed.
    public class StockResult
    {
        public bool Success { get; set; }
        public string? Error { get; set; }
        public MaterialDto? Material { get; set; }
    }
}
