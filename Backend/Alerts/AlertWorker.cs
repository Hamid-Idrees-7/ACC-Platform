using Backend.Demo;
using Backend.Models.Entities;
using Backend.Services;
using Microsoft.EntityFrameworkCore;

namespace Backend.Alerts
{
    public class AlertWorker : BackgroundService
    {
        private static readonly TimeSpan SweepEvery = TimeSpan.FromMinutes(10);
        private static readonly TimeSpan FirstSweep = TimeSpan.FromSeconds(20);
        private static readonly TimeSpan Debounce = TimeSpan.FromSeconds(1.5);

        private readonly AlertScheduler _scheduler;
        private readonly IServiceScopeFactory _scopes;
        private readonly DemoDbFactory _demoDbs;
        private readonly ILogger<AlertWorker> _logger;

        public AlertWorker(AlertScheduler scheduler, IServiceScopeFactory scopes, DemoDbFactory demoDbs, ILogger<AlertWorker> logger)
        {
            _scheduler = scheduler;
            _scopes = scopes;
            _demoDbs = demoDbs;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            var nextSweep = DateTime.UtcNow + FirstSweep;

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await WaitForWorkAsync(nextSweep - DateTime.UtcNow, stoppingToken);

                    var targets = new HashSet<string>();
                    while (_scheduler.Queue.TryRead(out var requested)) targets.Add(requested);

                    if (DateTime.UtcNow >= nextSweep)
                    {
                        nextSweep = DateTime.UtcNow + SweepEvery;
                        targets.Add(AlertScheduler.MainDatabase);
                        foreach (var demo in await ActiveDemoDatabasesAsync(stoppingToken)) targets.Add(demo);
                    }

                    foreach (var target in targets) await CheckAsync(target, stoppingToken);
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    break;
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Alert checks could not run.");
                    await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken);
                }
            }
        }

        private async Task WaitForWorkAsync(TimeSpan untilSweep, CancellationToken stoppingToken)
        {
            if (untilSweep <= TimeSpan.Zero) return;

            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(stoppingToken);
            timeout.CancelAfter(untilSweep);
            try
            {
                if (await _scheduler.Queue.WaitToReadAsync(timeout.Token))
                    await Task.Delay(Debounce, stoppingToken);
            }
            catch (OperationCanceledException) when (!stoppingToken.IsCancellationRequested)
            {
            }
        }

        private async Task<List<string>> ActiveDemoDatabasesAsync(CancellationToken ct)
        {
            try
            {
                await using var db = _demoDbs.CreateMain();
                var now = DateTime.UtcNow;
                var names = await db.DemoSessions.AsNoTracking()
                    .Where(s => s.Status == DemoSessionStatus.Active && !s.IsDropped && s.ExpiresAt > now)
                    .Select(s => s.DatabaseName)
                    .ToListAsync(ct);
                return names.Where(DemoDbFactory.IsValidName).ToList();
            }
            catch (Exception ex) when (!ct.IsCancellationRequested)
            {
                _logger.LogWarning(ex, "Could not list the running demos for alert checks.");
                return new List<string>();
            }
        }

        private async Task CheckAsync(string target, CancellationToken ct)
        {
            try
            {
                using var database = DatabaseScope.Use(target == AlertScheduler.MainDatabase ? null : target);
                using var scope = _scopes.CreateScope();
                var checker = scope.ServiceProvider.GetRequiredService<IAlertCheckService>();
                await checker.RunAsync(ct);
            }
            catch (Exception ex) when (!ct.IsCancellationRequested)
            {
                _logger.LogWarning(ex, "Alert check failed for {Database}.", target);
            }
        }
    }
}
