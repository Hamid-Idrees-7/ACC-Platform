using Backend.Data;
using Microsoft.EntityFrameworkCore;

namespace Backend.Services
{
    // Does the slow first-time work (EF model, first DB connection, BCrypt) at startup,
    // so the first sign-in after a restart is as quick as the rest.
    public class StartupWarmUp : BackgroundService
    {
        private readonly IServiceScopeFactory _scopes;
        private readonly ILogger<StartupWarmUp> _logger;
        private readonly TaskCompletionSource _done = new(TaskCreationOptions.RunContinuationsAsynchronously);

        public StartupWarmUp(IServiceScopeFactory scopes, ILogger<StartupWarmUp> logger)
        {
            _scopes = scopes;
            _logger = logger;
        }

        public Task Finished => _done.Task;

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            try
            {
                using var scope = _scopes.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                await db.Users.AsNoTracking().AnyAsync(stoppingToken);
                await db.Notifications.AsNoTracking().AnyAsync(n => !n.IsRead, stoppingToken);
                await db.LoginActivities.AsNoTracking().AnyAsync(stoppingToken);
                scope.ServiceProvider.GetRequiredService<IAuthService>();
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                _logger.LogWarning(ex, "Startup warm-up could not finish.");
            }
            finally
            {
                _done.TrySetResult();
            }
        }
    }
}
