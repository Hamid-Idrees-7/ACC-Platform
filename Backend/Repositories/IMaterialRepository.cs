using Backend.Models.Entities;

namespace Backend.Repositories
{
    public interface IMaterialRepository
    {
        Task<List<Material>> GetAllAsync();
        Task<Material?> GetByIdAsync(int id);
        Task<Material> AddAsync(Material material);
        Task UpdateAsync(Material material);
        Task<bool> DeleteAsync(int id);

        Task AddTransactionAsync(MaterialTransaction transaction);
        Task<decimal> GetStockAsync(int materialId);
        Task<Dictionary<int, MaterialStats>> GetStatsMapAsync();
        Task<List<MaterialTransaction>> GetTransactionsAsync(int materialId);
        Task<List<MaterialTransaction>> GetIssuesByProjectAsync(int projectId);
        Task<MaterialTransaction?> GetTransactionByIdAsync(int transactionId);
        Task UpdateTransactionAsync(MaterialTransaction transaction);
    }

    // Aggregated numbers derived from a material's ledger.
    public class MaterialStats
    {
        public decimal Stock { get; set; }
        public decimal PurchasedQty { get; set; }
        public decimal Invested { get; set; }

        public decimal AvgCost => PurchasedQty > 0 ? Invested / PurchasedQty : 0m;
    }
}
