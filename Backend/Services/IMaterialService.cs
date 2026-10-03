using Backend.Models.DTOs;
using Backend.Models.Entities;

namespace Backend.Services
{
    public interface IMaterialService
    {
        Task<List<MaterialDto>> GetAllMaterialsAsync();
        Task<MaterialDto?> GetMaterialByIdAsync(int id);
        Task<MaterialDto> CreateMaterialAsync(CreateMaterialDto dto);
        Task<MaterialDto?> UpdateMaterialAsync(int id, CreateMaterialDto dto);
        Task<string?> CheckUpdateAsync(int id, CreateMaterialDto dto);
        Task<bool> DeleteMaterialAsync(int id);
        Task<StockResult> RestockAsync(int id, RestockDto dto);
        Task<StockResult> IssueAsync(int id, IssueDto dto);
        Task<MaterialHistoryDto?> GetHistoryAsync(int id);
        Task<bool> HasIssuesAsync(int id);
        Task<StockResult> CancelTransactionAsync(int transactionId);
    }

    // Result of a restock or issue: the updated material, or the reason it failed.
    public class StockResult
    {
        public bool Success { get; set; }
        public string? Error { get; set; }
        public MaterialDto? Material { get; set; }
        public MaterialTransaction? Transaction { get; set; }
    }
}
