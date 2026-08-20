using Backend.Models.DTOs;
using Backend.Models.Entities;
using Backend.Repositories;

namespace Backend.Services
{
    public class MaterialService : IMaterialService
    {
        private readonly IMaterialRepository _repository;

        public MaterialService(IMaterialRepository repository)
        {
            _repository = repository;
        }

        public async Task<List<MaterialDto>> GetAllMaterialsAsync()
        {
            var materials = await _repository.GetAllAsync();
            var statsMap = await _repository.GetStatsMapAsync();

            return materials.Select(m =>
            {
                statsMap.TryGetValue(m.MaterialID, out var stats);
                var stock = stats?.Stock ?? 0m;
                var avgCost = stats?.AvgCost ?? 0m;
                return MapDto(m, stock, avgCost);
            }).ToList();
        }

        public async Task<MaterialDto?> GetMaterialByIdAsync(int id)
        {
            var material = await _repository.GetByIdAsync(id);
            return material == null ? null : await ToDtoAsync(material);
        }

        public async Task<MaterialDto> CreateMaterialAsync(CreateMaterialDto dto)
        {
            var material = new Material
            {
                Name = dto.Name.Trim(),
                Category = dto.Category.Trim(),
                Unit = dto.Unit.Trim(),
                LowStockThreshold = dto.LowStockThreshold,
                Status = dto.Status,
                CreatedAt = DateTime.Now,
                UpdatedAt = DateTime.Now
            };

            var created = await _repository.AddAsync(material);

            // An opening balance is recorded as the first restock so stock always
            // traces back to the ledger.
            if (dto.InitialStock.HasValue && dto.InitialStock.Value > 0)
            {
                await _repository.AddTransactionAsync(new MaterialTransaction
                {
                    MaterialID = created.MaterialID,
                    Type = "Restock",
                    Quantity = dto.InitialStock.Value,
                    Rate = dto.InitialRate ?? 0m,
                    Note = "Opening stock",
                    CreatedAt = DateTime.Now
                });
            }

            return await ToDtoAsync(created);
        }

        public async Task<MaterialDto?> UpdateMaterialAsync(int id, CreateMaterialDto dto)
        {
            var material = await _repository.GetByIdAsync(id);
            if (material == null) return null;

            material.Name = dto.Name.Trim();
            material.Category = dto.Category.Trim();
            material.Unit = dto.Unit.Trim();
            material.LowStockThreshold = dto.LowStockThreshold;
            material.Status = dto.Status;
            material.UpdatedAt = DateTime.Now;

            await _repository.UpdateAsync(material);
            return await ToDtoAsync(material);
        }

        public async Task<bool> DeleteMaterialAsync(int id)
        {
            return await _repository.DeleteAsync(id);
        }

        public async Task<StockResult> RestockAsync(int id, RestockDto dto)
        {
            var material = await _repository.GetByIdAsync(id);
            if (material == null)
                return new StockResult { Success = false, Error = "Material not found" };

            if (dto.Quantity <= 0)
                return new StockResult { Success = false, Error = "Quantity must be greater than zero." };

            if (dto.Rate < 0)
                return new StockResult { Success = false, Error = "Rate cannot be negative." };

            await _repository.AddTransactionAsync(new MaterialTransaction
            {
                MaterialID = id,
                Type = "Restock",
                Quantity = dto.Quantity,
                Rate = dto.Rate,
                Note = dto.Note?.Trim(),
                CreatedAt = DateTime.Now
            });

            material.UpdatedAt = DateTime.Now;
            await _repository.UpdateAsync(material);

            return new StockResult { Success = true, Material = await ToDtoAsync(material) };
        }

        public async Task<StockResult> IssueAsync(int id, IssueDto dto)
        {
            var material = await _repository.GetByIdAsync(id);
            if (material == null)
                return new StockResult { Success = false, Error = "Material not found" };

            if (dto.Quantity <= 0)
                return new StockResult { Success = false, Error = "Quantity must be greater than zero." };

            var transactions = await _repository.GetTransactionsAsync(id);
            var restocks = transactions.Where(t => t.Type == "Restock").ToList();
            var stock = transactions.Sum(t => t.Type == "Restock" ? t.Quantity : -t.Quantity);
            var purchasedQty = restocks.Sum(t => t.Quantity);
            var invested = restocks.Sum(t => t.Quantity * t.Rate);

            // Block issuing more than what is in stock; stock can never go negative.
            if (dto.Quantity > stock)
                return new StockResult { Success = false, Error = $"Only {stock} {material.Unit} available." };

            // Cost basis is locked to the weighted average cost at this moment,
            // so later purchases never rewrite the cost of past issues.
            var costAtIssue = purchasedQty > 0 ? invested / purchasedQty : 0m;

            await _repository.AddTransactionAsync(new MaterialTransaction
            {
                MaterialID = id,
                Type = "Issue",
                Quantity = dto.Quantity,
                Rate = costAtIssue,
                ProjectName = dto.ProjectName.Trim(),
                Note = dto.Note?.Trim(),
                CreatedAt = DateTime.Now
            });

            material.UpdatedAt = DateTime.Now;
            await _repository.UpdateAsync(material);

            return new StockResult { Success = true, Material = await ToDtoAsync(material) };
        }

        public async Task<MaterialHistoryDto?> GetHistoryAsync(int id)
        {
            var material = await _repository.GetByIdAsync(id);
            if (material == null) return null;

            var transactions = await _repository.GetTransactionsAsync(id);
            var restocks = transactions.Where(t => t.Type == "Restock").ToList();
            var issues = transactions.Where(t => t.Type == "Issue").ToList();

            var purchasedQty = restocks.Sum(t => t.Quantity);
            var invested = restocks.Sum(t => t.Quantity * t.Rate);
            var issuedQty = issues.Sum(t => t.Quantity);
            var issuedCost = issues.Sum(t => t.Quantity * t.Rate);

            return new MaterialHistoryDto
            {
                MaterialID = material.MaterialID,
                Name = material.Name,
                Unit = material.Unit,
                CurrentStock = purchasedQty - issuedQty,
                AvgCost = purchasedQty > 0 ? invested / purchasedQty : 0m,
                TotalPurchasedQty = purchasedQty,
                TotalInvested = invested,
                MinRate = restocks.Count > 0 ? restocks.Min(t => t.Rate) : 0m,
                MaxRate = restocks.Count > 0 ? restocks.Max(t => t.Rate) : 0m,
                TotalIssuedQty = issuedQty,
                TotalIssuedCost = issuedCost,
                TotalTransactions = transactions.Count,
                Transactions = transactions.Select(t => new MaterialTransactionDto
                {
                    TransactionID = t.TransactionID,
                    Type = t.Type,
                    Quantity = t.Quantity,
                    Rate = t.Rate,
                    ProjectName = t.ProjectName,
                    Note = t.Note,
                    CreatedAt = t.CreatedAt,
                    Amount = t.Quantity * t.Rate
                }).ToList()
            };
        }

        private async Task<MaterialDto> ToDtoAsync(Material material)
        {
            var transactions = await _repository.GetTransactionsAsync(material.MaterialID);
            var restocks = transactions.Where(t => t.Type == "Restock").ToList();

            var stock = transactions.Sum(t => t.Type == "Restock" ? t.Quantity : -t.Quantity);
            var purchasedQty = restocks.Sum(t => t.Quantity);
            var invested = restocks.Sum(t => t.Quantity * t.Rate);
            var avgCost = purchasedQty > 0 ? invested / purchasedQty : 0m;

            return MapDto(material, stock, avgCost);
        }

        private static MaterialDto MapDto(Material m, decimal stock, decimal avgCost)
        {
            return new MaterialDto
            {
                MaterialID = m.MaterialID,
                Name = m.Name,
                Category = m.Category,
                Unit = m.Unit,
                LowStockThreshold = m.LowStockThreshold,
                Status = m.Status,
                CurrentStock = stock,
                AvgCost = avgCost,
                StockValue = stock * avgCost,
                CreatedAt = m.CreatedAt
            };
        }
    }
}
