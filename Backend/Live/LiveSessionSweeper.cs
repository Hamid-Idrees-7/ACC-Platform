using Backend.Demo;
using Backend.Services;

namespace Backend.Live
{
    // Every minute, checks the sign-in behind each open live connection and closes the ones
    // whose sign-in has ended. Normal requests are checked one by one (SessionGuardMiddleware);
    // a live connection is a single long request, so it is checked here instead.
    public class LiveSessionSweeper : BackgroundService
    {
        private static readonly TimeSpan Every = TimeSpan.FromMinutes(1);

        private readonly IServiceScopeFactory _scopes;
        private readonly ILogger<LiveSessionSweeper> _logger;

        public LiveSessionSweeper(IServiceScopeFactory scopes, ILogger<LiveSessionSweeper> logger)
        {
            _scopes = scopes;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            using var timer = new PeriodicTimer(Every);
            while (await timer.WaitForNextTickAsync(stoppingToken))
            {
                foreach (var group in LiveConnections.All().GroupBy(e => e.DemoDatabase))
                {
                    try
                    {
                        using var database = DatabaseScope.Use(group.Key);
                        using var scope = _scopes.CreateScope();
                        var sessions = scope.ServiceProvider.GetRequiredService<ISessionService>();

                        foreach (var signIn in group.GroupBy(e => (e.UserId, e.LoginId)))
                        {
                            // markSeen: false, an open connection alone doesn't count as being active
                            var check = await sessions.CheckAsync(signIn.Key.LoginId, signIn.Key.UserId, markSeen: false);
                            if (check.Active) continue;
                            foreach (var entry in signIn) entry.Context.Abort();
                        }
                    }
                    catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
                    {
                        // A demo database that is gone closes its connections; anything else waits for the next round.
                        if (group.Key != null)
                            LiveConnections.AbortDatabase(group.Key);
                        else
                            _logger.LogWarning(ex, "Live connection check failed.");
                    }
                }
            }
        }
    }
}
