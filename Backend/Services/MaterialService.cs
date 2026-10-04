using Backend.Models.DTOs;
using Backend.Models.Entities;
using Backend.Repositories;

namespace Backend.Services
{
    public class MaterialService : IMaterialService
    {
        private readonly IMaterialRepository _repository;
        private readonly IProjectRepository _projectRepository;

        public MaterialService(IMaterialRepository repository, IProjectRepository projectRepository)
        {
            _repository = repository;
            _projectRepository = projectRepository;
        }

        public async Task<List<MaterialDto>> GetAllMaterialsAsync()
        {
            var materials = await _repository.GetAllAsync();
            var statsMap = await _repository.GetStatsMapAsync();

            return materials.Select(m =>
            {
                statsMap.TryGetValue(m.MaterialID, out var stats);
                return MapDto(m, stats?.Stock ?? 0m, stats?.AvgCost ?? 0m, stats?.StockValue ?? 0m);
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
                CreatedAt = AppTime.Now,
                UpdatedAt = AppTime.Now
            };

            var created = await _repository.AddAsync(material);

            // An opening balance is recorded as the first restock so stock always
            // traces back to the ledger.
            // Rounded first, so 0.004 doesn't save a restock of 0
            if (dto.InitialStock.HasValue && Math.Round(dto.InitialStock.Value, 2) > 0)
            {
                await _repository.AddTransactionAsync(new MaterialTransaction
                {
                    MaterialID = created.MaterialID,
                    Type = "Restock",
                    Quantity = Math.Round(dto.InitialStock.Value, 2),
                    Rate = Math.Round(dto.InitialRate ?? 0m, 2),
                    Note = "Opening stock",
                    CreatedAt = AppTime.Now
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
            material.UpdatedAt = AppTime.Now;

            await _repository.UpdateAsync(material);
            return await ToDtoAsync(material);
        }

        // Limits shared by every stock entry. Null when the values are fine.
        public static string? CheckCreate(CreateMaterialDto dto)
        {
            if (dto.LowStockThreshold < 0 || dto.LowStockThreshold > 1_000_000_000) return "Enter a valid low stock level.";
            if (dto.InitialStock is < 0) return "Opening stock can't be negative.";
            if (dto.InitialStock > MaxQuantity) return "The opening stock is too large.";
            if (dto.InitialRate is < 0) return "Rate cannot be negative.";
            if (dto.InitialRate > MaxRate) return "The rate is too large.";
            return null;
        }

        // A material's unit can't change once stock has moved in that unit (past quantities would mean something else).
        public async Task<string?> CheckUpdateAsync(int id, CreateMaterialDto dto)
        {
            if (dto.LowStockThreshold < 0 || dto.LowStockThreshold > 1_000_000_000) return "Enter a valid low stock level.";
            var material = await _repository.GetByIdAsync(id);
            if (material == null) return null;
            if (!string.Equals(material.Unit, dto.Unit.Trim(), StringComparison.OrdinalIgnoreCase) &&
                (await _repository.GetTransactionsAsync(id)).Count > 0)
                return $"The unit can't change because stock has already been recorded in {material.Unit}.";
            return null;
        }

        private const decimal MaxQuantity = 1_000_000_000m;
        private const decimal MaxRate = 1_000_000_000m;

        // Stock, purchases and the value of the stock on hand from the ledger (cancelled entries left out).
        private static MaterialStats Ledger(IEnumerable<MaterialTransaction> transactions)
        {
            var active = transactions.Where(t => !t.IsCancelled).ToList();
            return new MaterialStats
            {
                Stock = active.Sum(t => t.Type == "Restock" ? t.Quantity : -t.Quantity),
                PurchasedQty = active.Where(t => t.Type == "Restock").Sum(t => t.Quantity),
                Invested = active.Where(t => t.Type == "Restock").Sum(t => t.Quantity * t.Rate),
                IssuedCost = active.Where(t => t.Type == "Issue").Sum(t => t.Quantity * t.Rate)
            };
        }

        public async Task<bool> DeleteMaterialAsync(int id)
        {
            return await _repository.DeleteAsync(id);
        }

        // True if this material was ever issued to a project. It must then be deactivated,
        // not deleted, to keep project history.
        public async Task<bool> HasIssuesAsync(int id)
        {
            var transactions = await _repository.GetTransactionsAsync(id);
            return transactions.Any(t => t.Type == "Issue" && !t.IsCancelled);
        }

        // Why a material can't be deleted, or null if it can. Issues and purchases are project
        // cost and company spend, so a material with either is kept (set Inactive instead).
        public async Task<string?> GetDeleteBlockerAsync(int id)
        {
            var transactions = (await _repository.GetTransactionsAsync(id)).Where(t => !t.IsCancelled).ToList();
            if (transactions.Any(t => t.Type == "Issue"))
                return "This material has been issued to projects, so it can't be deleted. Keep it and set it to Inactive instead, or cancel its issues from the History page first.";
            if (transactions.Any(t => t.Type == "Restock"))
                return "This material has purchases on record, so it can't be deleted. Keep it and set it to Inactive instead, or cancel its purchases from the History page first.";
            return null;
        }

        public async Task<StockResult> RestockAsync(int id, RestockDto dto)
        {
            var material = await _repository.GetByIdAsync(id);
            if (material == null)
                return new StockResult { Success = false, Error = "Material not found" };

            // Rounded first, so 0.004 can't pass the check and be saved as 0
            var quantity = Math.Round(dto.Quantity, 2);
            var rate = Math.Round(dto.Rate, 2);
            if (quantity <= 0)
                return new StockResult { Success = false, Error = "Quantity must be greater than zero." };
            if (quantity > MaxQuantity)
                return new StockResult { Success = false, Error = "The quantity is too large." };

            if (rate < 0)
                return new StockResult { Success = false, Error = "Rate cannot be negative." };
            if (rate > MaxRate)
                return new StockResult { Success = false, Error = "The rate is too large." };

            using var _ = await Locks.ForStockAsync(_repository.DatabaseName, id);

            await _repository.AddTransactionAsync(new MaterialTransaction
            {
                MaterialID = id,
                Type = "Restock",
                Quantity = quantity,
                Rate = rate,
                Note = dto.Note?.Trim(),
                CreatedAt = AppTime.Now
            });

            material.UpdatedAt = AppTime.Now;
            await _repository.UpdateAsync(material);

            return new StockResult { Success = true, Material = await ToDtoAsync(material) };
        }

        // alsoSave runs in the same transaction and under the same stock lock, for work that must
        // be saved together with the issue (eg the request it fulfils), so neither happens alone.
        public async Task<StockResult> IssueAsync(int id, IssueDto dto, Func<Task>? alsoSave = null)
        {
            var material = await _repository.GetByIdAsync(id);
            if (material == null)
                return new StockResult { Success = false, Error = "Material not found" };

            var quantity = Math.Round(dto.Quantity, 2);
            if (quantity <= 0)
                return new StockResult { Success = false, Error = "Quantity must be greater than zero." };
            if (quantity > MaxQuantity)
                return new StockResult { Success = false, Error = "The quantity is too large." };

            // Stock always goes to a real, open project (so its cost lands on that project),
            // and the phase must be one of its own.
            if (dto.ProjectID == null)
                return new StockResult { Success = false, Error = "Choose a project." };
            var project = await _projectRepository.GetByIdAsync(dto.ProjectID.Value);
            if (project == null)
                return new StockResult { Success = false, Error = "Project not found." };
            if (project.Status == "Completed" || project.Status == "Cancelled")
                return new StockResult { Success = false, Error = $"{project.Title} is {project.Status.ToLower()}, so stock can't be issued to it." };
            var projectName = project.Title;
            if (dto.PhaseID != null)
            {
                var phase = await _projectRepository.GetPhaseByIdAsync(dto.PhaseID.Value);
                if (phase == null || phase.ProjectID != dto.ProjectID)
                    return new StockResult { Success = false, Error = "That phase belongs to another project." };
            }

            // One stock change at a time per material, so the check below can't go stale.
            using var _ = await Locks.ForStockAsync(_repository.DatabaseName, id);

            var ledger = Ledger(await _repository.GetTransactionsAsync(id));

            // Block issuing more than what is in stock; stock can never go negative.
            if (quantity > ledger.Stock)
                return new StockResult { Success = false, Error = $"Only {ledger.Stock} {material.Unit} available." };

            // Cost basis is locked to the average cost of the stock on hand at this moment,
            // so later purchases never rewrite the cost of past issues.
            var costAtIssue = Math.Round(ledger.AvgCost, 2);

            var issue = new MaterialTransaction
            {
                MaterialID = id,
                Type = "Issue",
                Quantity = quantity,
                Rate = costAtIssue,
                ProjectName = projectName.Length > 100 ? projectName[..100] : projectName,
                ProjectID = dto.ProjectID,
                PhaseID = dto.PhaseID,
                Note = dto.Note?.Trim(),
                CreatedAt = AppTime.Now
            };
            await using var transaction = alsoSave == null ? null : await _repository.BeginTransactionAsync();
            await _repository.AddTransactionAsync(issue);

            material.UpdatedAt = AppTime.Now;
            await _repository.UpdateAsync(material);

            if (alsoSave != null)
            {
                await alsoSave();
                if (transaction != null) await transaction.CommitAsync();
            }

            return new StockResult { Success = true, Material = await ToDtoAsync(material), Transaction = issue };
        }

        public async Task<MaterialHistoryDto?> GetHistoryAsync(int id)
        {
            var material = await _repository.GetByIdAsync(id);
            if (material == null) return null;

            var transactions = await _repository.GetTransactionsAsync(id);

            // Totals count only active (non-cancelled) transactions.
            var restocks = transactions.Where(t => t.Type == "Restock" && !t.IsCancelled).ToList();
            var issues = transactions.Where(t => t.Type == "Issue" && !t.IsCancelled).ToList();

            var purchasedQty = restocks.Sum(t => t.Quantity);
            var invested = restocks.Sum(t => t.Quantity * t.Rate);
            var issuedQty = issues.Sum(t => t.Quantity);
            var issuedCost = issues.Sum(t => t.Quantity * t.Rate);
            var ledger = Ledger(transactions);

            // An issue is "locked" (can't be cancelled) once its project is Completed.
            var projectIds = transactions.Where(t => t.ProjectID.HasValue).Select(t => t.ProjectID!.Value).Distinct().ToList();
            var completedProjects = new HashSet<int>();
            foreach (var pid in projectIds)
            {
                var proj = await _projectRepository.GetByIdAsync(pid);
                if (proj != null && proj.Status == "Completed") completedProjects.Add(pid);
            }

            return new MaterialHistoryDto
            {
                MaterialID = material.MaterialID,
                Name = material.Name,
                Unit = material.Unit,
                CurrentStock = purchasedQty - issuedQty,
                AvgCost = ledger.AvgCost,
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
                    Amount = t.Quantity * t.Rate,
                    IsCancelled = t.IsCancelled,
                    Locked = t.Type == "Issue" && t.ProjectID.HasValue && completedProjects.Contains(t.ProjectID.Value)
                }).ToList()
            };
        }

        // Reverse a transaction: keep the record but mark it cancelled so it no
        // longer counts toward stock, cost, or totals.
        public async Task<StockResult> CancelTransactionAsync(int transactionId)
        {
            var found = await _repository.GetTransactionByIdAsync(transactionId);
            if (found == null)
                return new StockResult { Success = false, Error = "Transaction not found." };

            using var _ = await Locks.ForStockAsync(_repository.DatabaseName, found.MaterialID);

            // Read again inside the lock, in case it was cancelled a moment ago.
            var tx = await _repository.GetTransactionByIdAsync(transactionId);
            if (tx == null)
                return new StockResult { Success = false, Error = "Transaction not found." };
            if (tx.IsCancelled)
                return new StockResult { Success = false, Error = "This transaction is already cancelled." };

            // An issue on a completed project is locked.
            if (tx.Type == "Issue" && tx.ProjectID.HasValue)
            {
                var proj = await _projectRepository.GetByIdAsync(tx.ProjectID.Value);
                if (proj != null && proj.Status == "Completed")
                    return new StockResult { Success = false, Error = "This issue is locked — its project is completed." };
            }

            // Cancelling a purchase removes its quantity from stock; block if that
            // stock has already been issued (would push stock negative).
            if (tx.Type == "Restock")
            {
                // Issues made after this purchase were costed with its price in the average.
                // Taking the purchase out now would leave the remaining stock at a wrong cost.
                var later = (await _repository.GetTransactionsAsync(tx.MaterialID))
                    .Count(t => t.Type == "Issue" && !t.IsCancelled && t.TransactionID > tx.TransactionID);
                if (later > 0)
                    return new StockResult { Success = false, Error = $"{later} issue{(later == 1 ? " was" : "s were")} costed with this purchase's price after it was made. Cancel those issues first (newest first), then this purchase." };

                var stock = await _repository.GetStockAsync(tx.MaterialID);
                if (stock - tx.Quantity < 0)
                {
                    var issuedAway = tx.Quantity - stock;
                    return new StockResult { Success = false, Error = $"Can't cancel this purchase of {tx.Quantity}: only {stock} is still in stock ({issuedAway} was already issued to projects). Cancel those issues first." };
                }
            }

            tx.IsCancelled = true;
            await _repository.UpdateTransactionAsync(tx);

            var material = await _repository.GetByIdAsync(tx.MaterialID);
            if (material != null)
            {
                material.UpdatedAt = AppTime.Now;
                await _repository.UpdateAsync(material);
            }

            return new StockResult { Success = true, Material = material != null ? await ToDtoAsync(material) : null, Transaction = tx };
        }

        private async Task<MaterialDto> ToDtoAsync(Material material)
        {
            var ledger = Ledger(await _repository.GetTransactionsAsync(material.MaterialID));
            return MapDto(material, ledger.Stock, ledger.AvgCost, ledger.StockValue);
        }

        private static MaterialDto MapDto(Material m, decimal stock, decimal avgCost, decimal stockValue)
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
                StockValue = stockValue,
                CreatedAt = m.CreatedAt
            };
        }
    }
}
