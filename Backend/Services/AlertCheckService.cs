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

            var now = AppTime.Now;
            var rules = new AlertRuleSet(await _repository.GetRulesAsync());
            var facts = await _repository.LoadFactsAsync(now);

            var open = await _repository.GetOpenAsync();

            if (rules.IsEnabled(AlertTypes.SalaryPending))
            {
                // The last three months, plus any older month whose "not fully paid" alert is
                // still open, so that alert only closes once the month is really paid.
                var month = new DateTime(now.Year, now.Month, 1);
                var months = Enumerable.Range(1, 3).Select(back => month.AddMonths(-back)).ToHashSet();
                foreach (var alert in open.Where(a => a.Type == AlertTypes.SalaryPending))
                    if (DateTime.TryParseExact(alert.Key, "yyyy-MM", System.Globalization.CultureInfo.InvariantCulture,
                            System.Globalization.DateTimeStyles.None, out var older) && older < month)
                        months.Add(older);

                foreach (var period in months.OrderByDescending(m => m))
                    facts.SalaryPeriods.Add(await _salaries.GetPeriodAsync(period.Year, period.Month, null));
            }

            var found = AlertConditions.Find(facts, rules);
            var changes = AlertReconciler.Reconcile(open, found, rules, now);
            await _repository.ApplyAsync(changes, now - AlertCatalog.KeepResolved);
            return changes;
        }
    }
}
