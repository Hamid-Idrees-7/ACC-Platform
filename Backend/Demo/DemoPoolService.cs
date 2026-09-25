using Microsoft.Extensions.Options;

namespace Backend.Demo
{
    // Background worker for the visitor demo. Every minute (or sooner when woken up) it expires
    // finished sessions, drops their databases and keeps the ready pool topped up.
    // Every SweepHours it also rebuilds the waiting pool and clears any leftover databases.
    public class DemoPoolService : BackgroundService
    {
        private readonly DemoManager _manager;
        private readonly DemoOptions _options;
        private readonly ILogger<DemoPoolService> _logger;

        public DemoPoolService(DemoManager manager, IOptions<DemoOptions> options, ILogger<DemoPoolService> logger)
        {
            _manager = manager;
            _options = options.Value;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            if (!_options.Enabled) return;

            // Let the app finish starting up before doing any database work.
            await Task.Yield();

            // A full sweep on start-up: databases left from before a restart are rebuilt with the latest seed.
            var lastFullSweep = DateTime.MinValue;

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    var fullSweep = DateTime.UtcNow - lastFullSweep >= TimeSpan.FromHours(_options.SweepHours);
                    await _manager.MaintainAsync(fullSweep, stoppingToken);
                    if (fullSweep) lastFullSweep = DateTime.UtcNow;
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    break;
                }
                catch (Exception ex)
                {
                    // Never let the worker die (e.g. the DemoSessions table doesn't exist yet).
                    _logger.LogError(ex, "Demo maintenance failed.");
                }

                try
                {
                    await _manager.WaitForSignalAsync(TimeSpan.FromMinutes(1), stoppingToken);
                }
                catch (OperationCanceledException)
                {
                    break;
                }
            }
        }
    }
}
