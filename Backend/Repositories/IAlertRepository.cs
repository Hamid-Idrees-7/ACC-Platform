using Backend.Alerts;
using Backend.Models.Entities;

namespace Backend.Repositories
{
    public interface IAlertRepository
    {
        string DatabaseName { get; }
        Task<AlertFacts> LoadFactsAsync(DateTime now);
        Task<List<Alert>> GetOpenAsync();
        Task<List<Alert>> GetResolvedSinceAsync(DateTime since);
        Task<Alert?> GetAsync(int id);
        Task AddAsync(Alert alert);
        Task UpdateAsync(Alert alert);
        Task ApplyAsync(AlertChanges changes, DateTime purgeResolvedBefore);
        Task<List<AlertRule>> GetRulesAsync();
        Task<AlertRule?> GetRuleAsync(string type);
        Task SaveRuleAsync(AlertRule rule);
    }
}
