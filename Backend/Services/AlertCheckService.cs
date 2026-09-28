using Backend.Alerts;
using Backend.Repositories;

namespace Backend.Services
{
    public class AlertCheckService : IAlertCheckService
    {
        private readonly IAlertRepository _repository;
        private readonly ISalaryService _salaries;
        private readonly AlertScheduler _scheduler;

        public AlertCheckService(IAlertRepository repository, ISalaryService salaries, AlertScheduler scheduler)
        {
            _repository = repository;
            _salaries = salaries;
            _scheduler = scheduler;
        }

        public async Task<AlertChanges> RunAsync(CancellationToken ct = default)
        {
            using var hold = await _scheduler.LockAsync(_repository.DatabaseName, ct);

            var now = DateTime.Now;
            var rules = new AlertRuleSet(await _repository.GetRulesAsync());
            var facts = await _repository.LoadFactsAsync(now);

            if (rules.IsEnabled(AlertTypes.SalaryPending))
            {
                var month = new DateTime(now.Year, now.Month, 1);
                for (var back = 1; back <= 3; back++)
                {
                    var period = month.AddMonths(-back);
                    facts.SalaryPeriods.Add(await _salaries.GetPeriodAsync(period.Year, period.Month, null));
                }
            }

            var found = AlertConditions.Find(facts, rules);
            var open = await _repository.GetOpenAsync();
            var changes = AlertReconciler.Reconcile(open, found, rules, now);
            await _repository.ApplyAsync(changes, now - AlertCatalog.KeepResolved);
            return changes;
        }
    }
}
