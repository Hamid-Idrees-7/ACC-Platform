using Backend.Data;
using Backend.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace Backend.Repositories
{
    public class MaterialRepository : IMaterialRepository
    {
        private readonly AppDbContext _context;

        public MaterialRepository(AppDbContext context)
        {
            _context = context;
        }

        public async Task<List<Material>> GetAllAsync()
        {
            return await _context.Materials
                .OrderByDescending(m => m.MaterialID)
                .ToListAsync();
        }

        public async Task<Material?> GetByIdAsync(int id)
        {
            return await _context.Materials.FindAsync(id);
        }

        public async Task<Material> AddAsync(Material material)
        {
            _context.Materials.Add(material);
            await _context.SaveChangesAsync();
            return material;
        }

        public async Task UpdateAsync(Material material)
        {
            _context.Materials.Update(material);
            await _context.SaveChangesAsync();
        }

        public async Task<bool> DeleteAsync(int id)
        {
            var material = await _context.Materials.FindAsync(id);
            if (material == null) return false;

            // The FK cascade removes this material's transactions with it.
            _context.Materials.Remove(material);
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task AddTransactionAsync(MaterialTransaction transaction)
        {
            _context.MaterialTransactions.Add(transaction);
            await _context.SaveChangesAsync();
        }

        // Stock is restocked quantity minus issued quantity, read from the ledger.
        public async Task<decimal> GetStockAsync(int materialId)
        {
            var restocked = await _context.MaterialTransactions
                .Where(t => t.MaterialID == materialId && t.Type == "Restock")
                .SumAsync(t => (decimal?)t.Quantity) ?? 0m;

            var issued = await _context.MaterialTransactions
                .Where(t => t.MaterialID == materialId && t.Type == "Issue")
                .SumAsync(t => (decimal?)t.Quantity) ?? 0m;

            return restocked - issued;
        }

        // One grouped query returns stock and purchase cost for every material,
        // so the list page avoids a separate query per material.
        public async Task<Dictionary<int, MaterialStats>> GetStatsMapAsync()
        {
            var rows = await _context.MaterialTransactions
                .GroupBy(t => t.MaterialID)
                .Select(g => new
                {
                    MaterialID = g.Key,
                    Stock = g.Sum(t => t.Type == "Restock" ? t.Quantity : -t.Quantity),
                    PurchasedQty = g.Sum(t => t.Type == "Restock" ? t.Quantity : 0m),
                    Invested = g.Sum(t => t.Type == "Restock" ? t.Quantity * t.Rate : 0m)
                })
                .ToListAsync();

            return rows.ToDictionary(
                r => r.MaterialID,
                r => new MaterialStats
                {
                    Stock = r.Stock,
                    PurchasedQty = r.PurchasedQty,
                    Invested = r.Invested
                });
        }

        public async Task<List<MaterialTransaction>> GetTransactionsAsync(int materialId)
        {
            return await _context.MaterialTransactions
                .Where(t => t.MaterialID == materialId)
                .OrderByDescending(t => t.CreatedAt)
                .ThenByDescending(t => t.TransactionID)
                .ToListAsync();
        }
    }
}
