using System.Runtime.CompilerServices;
using Backend.Alerts;
using Backend.Demo;
using Backend.Models.Entities;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace Backend.Live
{
    public class LiveChangeInterceptor : SaveChangesInterceptor
    {
        private readonly IHubContext<LiveHub> _hub;
        private readonly AlertScheduler _alerts;
        private readonly ILogger<LiveChangeInterceptor> _logger;

        private sealed class Pending
        {
            public HashSet<string> Modules { get; } = new();
            public Dictionary<int, HashSet<string>> Notified { get; } = new();
        }

        private readonly ConditionalWeakTable<DbContext, Pending> _pending = new();

        public LiveChangeInterceptor(IHubContext<LiveHub> hub, AlertScheduler alerts, ILogger<LiveChangeInterceptor> logger)
        {
            _hub = hub;
            _alerts = alerts;
            _logger = logger;
        }

        public override InterceptionResult<int> SavingChanges(DbContextEventData eventData, InterceptionResult<int> result)
        {
            Collect(eventData.Context);
            return base.SavingChanges(eventData, result);
        }

        public override ValueTask<InterceptionResult<int>> SavingChangesAsync(DbContextEventData eventData,
            InterceptionResult<int> result, CancellationToken cancellationToken = default)
        {
            Collect(eventData.Context);
            return base.SavingChangesAsync(eventData, result, cancellationToken);
        }

        public override int SavedChanges(SaveChangesCompletedEventData eventData, int result)
        {
            Publish(eventData.Context);
            return base.SavedChanges(eventData, result);
        }

        public override ValueTask<int> SavedChangesAsync(SaveChangesCompletedEventData eventData, int result,
            CancellationToken cancellationToken = default)
        {
            Publish(eventData.Context);
            return base.SavedChangesAsync(eventData, result, cancellationToken);
        }

        public override void SaveChangesFailed(DbContextErrorEventData eventData)
        {
            if (eventData.Context != null) _pending.Remove(eventData.Context);
            base.SaveChangesFailed(eventData);
        }

        public override Task SaveChangesFailedAsync(DbContextErrorEventData eventData, CancellationToken cancellationToken = default)
        {
            if (eventData.Context != null) _pending.Remove(eventData.Context);
            return base.SaveChangesFailedAsync(eventData, cancellationToken);
        }

        private void Collect(DbContext? context)
        {
            if (context == null) return;
            var pending = _pending.GetValue(context, _ => new Pending());

            foreach (var entry in context.ChangeTracker.Entries())
            {
                if (entry.State is not (EntityState.Added or EntityState.Modified or EntityState.Deleted)) continue;
                if (entry.State == EntityState.Modified && entry.Entity is User && OnlySignInTime(entry)) continue;

                if (entry.Entity is Notification notification)
                {
                    if (!pending.Notified.TryGetValue(notification.UserID, out var types))
                        pending.Notified[notification.UserID] = types = new HashSet<string>();
                    types.Add(notification.Type);
                    continue;
                }

                var module = LiveModules.For(entry.Entity.GetType());
                if (module != null) pending.Modules.Add(module);
            }
        }

        private static bool OnlySignInTime(Microsoft.EntityFrameworkCore.ChangeTracking.EntityEntry entry) =>
            entry.Properties.Where(p => p.IsModified).All(p => p.Metadata.Name == nameof(User.LastLogin));

        // Inside a transaction the update waits for the commit (see LiveTransactionInterceptor),
        // so clients never reload data that is not saved yet or is rolled back.
        private void Publish(DbContext? context, bool committed = false)
        {
            if (context == null || !_pending.TryGetValue(context, out var pending)) return;
            if (!committed && context.Database.CurrentTransaction != null) return;
            _pending.Remove(context);
            if (pending.Modules.Count == 0 && pending.Notified.Count == 0) return;

            var modules = pending.Modules.ToArray();
            var notified = pending.Notified.ToDictionary(n => n.Key, n => n.Value.ToArray());
            var databaseName = DatabaseName(context);

            if (modules.Any(m => m != LiveModules.Alerts))
                _alerts.Request(DemoDbFactory.IsValidName(databaseName) ? databaseName : null);

            _ = SendAsync(LiveGroups.ForDatabase(databaseName), modules, notified);
        }

        public void TransactionEnded(DbContext? context, bool committed)
        {
            if (context == null) return;
            if (committed) Publish(context, committed: true);
            else _pending.Remove(context);
        }

        private async Task SendAsync(string database, string[] modules, Dictionary<int, string[]> notified)
        {
            try
            {
                if (modules.Length > 0)
                    await _hub.Clients.Group(LiveGroups.Database(database)).SendAsync("data", new { modules });

                foreach (var (userId, types) in notified)
                    await _hub.Clients.Group(LiveGroups.User(database, userId)).SendAsync("notifications", new { types });
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Live update could not be sent.");
            }
        }

        private static string? DatabaseName(DbContext context)
        {
            try
            {
                return context.Database.GetDbConnection().Database;
            }
            catch
            {
                return DatabaseScope.DemoDatabase;
            }
        }
    }
}
