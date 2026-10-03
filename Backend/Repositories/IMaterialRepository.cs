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

        // The database this repository works on (stock locks are per database).
        string DatabaseName { get; }
    }

    // Totals worked out from a material's ledger.
    public class MaterialStats
    {
        public decimal Stock { get; set; }
        public decimal PurchasedQty { get; set; }
        public decimal Invested { get; set; }
        public decimal IssuedCost { get; set; }

        // What the stock on hand cost: everything bought minus the cost already charged to projects.
        public decimal StockValue => Stock > 0 ? Math.Max(0m, Invested - IssuedCost) : 0m;

        // Moving average: the cost of the stock on hand per unit, so a price change only affects
        // the units bought at that price.
        public decimal AvgCost => Stock > 0 ? StockValue / Stock : 0m;
    }
}
