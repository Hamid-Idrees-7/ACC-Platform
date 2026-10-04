using Backend.Alerts;
using Backend.Auth;
using Backend.Models.Entities;
using Backend.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;

namespace Backend.Demo
{
    // Outcome of starting a demo or switching role inside one.
    public class DemoResult
    {
        public bool Success { get; init; }
        public int StatusCode { get; init; } = 200;
        public string? Error { get; init; }

        public int SessionId { get; init; }
        public string DatabaseName { get; init; } = string.Empty;
        public DateTime ExpiresAtUtc { get; init; }
        public string RoleKey { get; init; } = string.Empty;
        public string RoleLabel { get; init; } = string.Empty;
        public User? User { get; init; }

        // The sign-in row (LoginActivity) in the visitor's database that the token points to.
        public int LoginId { get; init; }

        public static DemoResult Fail(int statusCode, string error) =>
            new() { Success = false, StatusCode = statusCode, Error = error };
    }

    // Runs the visitor demo. Every visitor gets a private database of their own:
    //   - a small pool of databases is kept ready so visitors get in instantly,
    //   - at most MaxVisitors sessions are active at the same time,
    //   - each session lasts SessionMinutes, then its database is dropped,
    //   - every SweepHours the waiting pool is rebuilt and leftovers are removed.
    // The registry (DemoSessions) lives in the main database. One lock serialises every change
    // to it; the slow work (building / dropping databases) always happens outside the lock.
    public class DemoManager
    {
        private record DemoRole(string Username, string Label);

        private static readonly Dictionary<string, DemoRole> Roles = new()
        {
            ["admin"] = new DemoRole(DemoSeeder.AdminUsername, "Admin"),
            ["manager"] = new DemoRole(DemoSeeder.ManagerUsername, "Manager"),
            ["engineer"] = new DemoRole(DemoSeeder.EngineerUsername, "Site Engineer"),
        };

        // Role key used when a visitor views the system as a user they created themselves.
        public const string CustomRoleKey = "custom";

        private record SessionSnapshot(string DatabaseName, bool IsActive, DateTime? ExpiresAt);

        private readonly DemoDbFactory _factory;
        private readonly DemoOptions _options;
        private readonly IMemoryCache _cache;
        private readonly ILogger<DemoManager> _logger;
        private readonly AlertScheduler _alerts;

        private readonly SemaphoreSlim _lock = new(1, 1);
        private readonly SemaphoreSlim _signal = new(0, 1);

        // The seat each visitor (by network address) holds. One seat per visitor: starting a new
        // demo ends their previous one, so a single person or script can't fill every seat.
        // Only read and changed under _lock.
        private readonly Dictionary<string, int> _seatByVisitor = new();

        public DemoManager(DemoDbFactory factory, IOptions<DemoOptions> options, IMemoryCache cache, ILogger<DemoManager> logger,
            AlertScheduler alerts)
        {
            _factory = factory;
            _options = options.Value;
            _cache = cache;
            _logger = logger;
            _alerts = alerts;
        }

        public bool Enabled => _options.Enabled;
        public int SessionMinutes => _options.SessionMinutes;

        // Status

        public async Task<(bool Enabled, bool Available)> GetStatusAsync(CancellationToken ct)
        {
            if (!_options.Enabled) return (false, false);

            await using var main = _factory.CreateMain();
            var inUse = await CountSeatsInUseAsync(main, DateTime.UtcNow, ct);
            return (true, inUse < _options.MaxVisitors);
        }

        // Start, switch and end

        public async Task<DemoResult> StartAsync(string role, ClientInfo client, CancellationToken ct)
        {
            if (!_options.Enabled)
                return DemoResult.Fail(404, "The live demo isn't available right now.");

            var roleKey = (role ?? string.Empty).Trim().ToLowerInvariant();
            if (!Roles.ContainsKey(roleKey))
                return DemoResult.Fail(400, "Unknown demo role.");

            int sessionId;
            string databaseName;
            DateTime expiresAt = default;
            bool buildNow;

            var visitor = ClientPartition.For(client.IpAddress);
            int? endedPrevious = null;

            await _lock.WaitAsync(ct);
            try
            {
                await using var main = _factory.CreateMain();
                var now = DateTime.UtcNow;

                // Forget seats that have already ended, so the map stays small.
                var liveIds = await main.DemoSessions
                    .Where(s => s.Status == DemoSessionStatus.Active || s.Status == DemoSessionStatus.Claimed)
                    .Select(s => s.DemoSessionID)
                    .ToListAsync(ct);
                foreach (var stale in _seatByVisitor.Where(p => !liveIds.Contains(p.Value)).Select(p => p.Key).ToList())
                    _seatByVisitor.Remove(stale);

                if (_seatByVisitor.TryGetValue(visitor, out var previousId))
                {
                    var previous = await main.DemoSessions.FirstOrDefaultAsync(s => s.DemoSessionID == previousId, ct);
                    if (previous != null &&
                        (previous.Status == DemoSessionStatus.Active || previous.Status == DemoSessionStatus.Claimed))
                    {
                        previous.Status = DemoSessionStatus.Ended;
                        previous.EndedAt = now;
                        await main.SaveChangesAsync(ct);
                        endedPrevious = previousId;
                    }
                    _seatByVisitor.Remove(visitor);
                }

                if (await CountSeatsInUseAsync(main, now, ct) >= _options.MaxVisitors)
                    return DemoResult.Fail(503,
                        $"All {_options.MaxVisitors} demo seats are in use right now. Please try again in a few minutes.");

                var session = await main.DemoSessions
                    .Where(s => s.Status == DemoSessionStatus.Ready && !s.IsDropped)
                    .OrderBy(s => s.CreatedAt)
                    .FirstOrDefaultAsync(ct);

                buildNow = session == null;
                if (session == null)
                {
                    // The ready pool is empty (eg just after start-up): build one for this visitor now.
                    session = new DemoSession
                    {
                        DatabaseName = DemoDbFactory.NewDatabaseName(),
                        Status = DemoSessionStatus.Claimed,
                        CreatedAt = now
                    };
                    main.DemoSessions.Add(session);
                }
                else
                {
                    expiresAt = Activate(session, now);
                }

                session.StartRole = roleKey;
                await main.SaveChangesAsync(ct);

                sessionId = session.DemoSessionID;
                databaseName = session.DatabaseName;
                _seatByVisitor[visitor] = sessionId;
            }
            finally
            {
                _lock.Release();
            }

            if (endedPrevious != null) _cache.Remove(CacheKey(endedPrevious.Value));

            // Top the ready pool back up in the background.
            RequestMaintenance();

            if (buildNow)
            {
                // Not tied to the request: if the visitor gives up, the seat is still cleaned up properly.
                var built = await BuildDatabaseAsync(databaseName, CancellationToken.None);

                await _lock.WaitAsync(CancellationToken.None);
                try
                {
                    await using var main = _factory.CreateMain();
                    var row = await main.DemoSessions.FirstAsync(s => s.DemoSessionID == sessionId);

                    if (!built || row.Status != DemoSessionStatus.Claimed)
                    {
                        row.Status = DemoSessionStatus.Ended;
                        row.EndedAt ??= DateTime.UtcNow;
                        await main.SaveChangesAsync();
                        RequestMaintenance();   // maintenance drops the failed database
                        return DemoResult.Fail(500, "We couldn't prepare the demo. Please try again.");
                    }

                    expiresAt = Activate(row, DateTime.UtcNow);
                    await main.SaveChangesAsync();
                }
                finally
                {
                    _lock.Release();
                }
            }

            return await LoadRoleAsync(sessionId, databaseName, expiresAt, roleKey, client, null, CancellationToken.None);
        }

        // Switch to another demo role inside the same visitor database. The clock keeps running.
        // previousLoginId: the sign-in being replaced (it ends as "RoleSwitched").
        public async Task<DemoResult> SwitchAsync(int sessionId, string databaseName, string role,
            ClientInfo client, int? previousLoginId, CancellationToken ct)
        {
            var roleKey = (role ?? string.Empty).Trim().ToLowerInvariant();
            if (!Roles.ContainsKey(roleKey))
                return DemoResult.Fail(400, "Unknown demo role.");

            var expiresAt = await GetActiveExpiryAsync(sessionId, databaseName, ct);
            if (expiresAt == null)
                return DemoResult.Fail(401, "Your demo session has ended.");

            return await LoadRoleAsync(sessionId, databaseName, expiresAt.Value, roleKey, client, previousLoginId, ct);
        }

        // View as: see the system exactly as another user in the visitor's own demo database
        // (typically a user the visitor just created and gave permissions to in Control Unit).
        // Same database, same timer. The lookup only ever reads the visitor's database.
        public async Task<DemoResult> ViewAsAsync(int sessionId, string databaseName, int userId,
            ClientInfo client, int? previousLoginId, CancellationToken ct)
        {
            var expiresAt = await GetActiveExpiryAsync(sessionId, databaseName, ct);
            if (expiresAt == null)
                return DemoResult.Fail(401, "Your demo session has ended.");

            await using var demo = _factory.CreateForDemo(databaseName);
            var user = await demo.Users.FirstOrDefaultAsync(u => u.UserID == userId, ct);

            if (user == null)
                return DemoResult.Fail(404, "User not found.");
            if (!user.IsActive)
                return DemoResult.Fail(409, $"{user.FullName} is disabled. Enable the account first to view as them.");

            // One of the three built-in demo logins behaves exactly like the role switcher.
            var builtIn = Roles.FirstOrDefault(r => r.Value.Username == user.Username);
            if (builtIn.Value != null)
                return await CompleteSignInAsync(demo, user, sessionId, databaseName, expiresAt.Value,
                    builtIn.Key, builtIn.Value.Label, client, previousLoginId, ct);

            return await CompleteSignInAsync(demo, user, sessionId, databaseName, expiresAt.Value,
                CustomRoleKey, user.FullName, client, previousLoginId, ct);
        }

        // The visitor pressed "Exit demo" (or logged out): free the seat and drop the database now.
        public async Task EndAsync(int sessionId, string databaseName, CancellationToken ct)
        {
            await _lock.WaitAsync(ct);
            try
            {
                await using var main = _factory.CreateMain();
                var session = await main.DemoSessions
                    .FirstOrDefaultAsync(s => s.DemoSessionID == sessionId && s.DatabaseName == databaseName, ct);

                if (session != null && session.Status == DemoSessionStatus.Active)
                {
                    session.Status = DemoSessionStatus.Ended;
                    session.EndedAt = DateTime.UtcNow;
                    await main.SaveChangesAsync(ct);
                }
            }
            finally
            {
                _lock.Release();
            }

            _cache.Remove(CacheKey(sessionId));
            RequestMaintenance();
        }

        // Called on every request that carries a demo token. Cached briefly so the main
        // database isn't queried on every click; expiry itself is always checked exactly.
        public async Task<bool> IsActiveAsync(int sessionId, string databaseName, CancellationToken ct)
        {
            var key = CacheKey(sessionId);
            if (!_cache.TryGetValue(key, out SessionSnapshot? snapshot) || snapshot == null)
            {
                await using var main = _factory.CreateMain();
                var row = await main.DemoSessions.AsNoTracking()
                    .Where(s => s.DemoSessionID == sessionId)
                    .Select(s => new { s.DatabaseName, s.Status, s.ExpiresAt })
                    .FirstOrDefaultAsync(ct);

                snapshot = row == null
                    ? new SessionSnapshot(string.Empty, false, null)
                    : new SessionSnapshot(row.DatabaseName, row.Status == DemoSessionStatus.Active, row.ExpiresAt);

                _cache.Set(key, snapshot, TimeSpan.FromSeconds(20));
            }

            return snapshot.IsActive &&
                   snapshot.DatabaseName == databaseName &&
                   snapshot.ExpiresAt > DateTime.UtcNow;
        }

        // Maintenance

        // Wake the background service early (eg a seat was just taken or freed).
        public void RequestMaintenance()
        {
            try
            {
                if (_signal.CurrentCount == 0) _signal.Release();
            }
            catch (SemaphoreFullException)
            {
                // Already signalled.
            }
        }

        public async Task WaitForSignalAsync(TimeSpan timeout, CancellationToken ct)
        {
            await _signal.WaitAsync(timeout, ct);
        }

        // Expires finished sessions, drops their databases and refills the ready pool.
        // A full sweep also rebuilds the waiting pool and removes any leftover databases.
        public async Task MaintainAsync(bool fullSweep, CancellationToken ct)
        {
            if (!_options.Enabled) return;

            List<string> toDrop;

            await _lock.WaitAsync(ct);
            try
            {
                await using var main = _factory.CreateMain();
                var now = DateTime.UtcNow;
                var open = await main.DemoSessions.Where(s => !s.IsDropped).ToListAsync(ct);

                foreach (var s in open)
                {
                    var expired = s.Status == DemoSessionStatus.Active && (s.ExpiresAt == null || s.ExpiresAt <= now);
                    var stuck = (s.Status == DemoSessionStatus.Preparing || s.Status == DemoSessionStatus.Claimed) &&
                                s.CreatedAt < now.AddMinutes(-10);
                    var refresh = fullSweep && s.Status == DemoSessionStatus.Ready;

                    if (expired || stuck || refresh)
                    {
                        s.Status = DemoSessionStatus.Ended;
                        s.EndedAt ??= now;
                    }
                }

                await main.SaveChangesAsync(ct);
                toDrop = open.Where(s => s.Status == DemoSessionStatus.Ended).Select(s => s.DatabaseName).ToList();

                if (fullSweep)
                {
                    // Keep the registry small: forget sessions that ended more than a week ago.
                    var cutoff = now.AddDays(-7);
                    var old = await main.DemoSessions.Where(s => s.IsDropped && s.EndedAt < cutoff).ToListAsync(ct);
                    if (old.Count > 0)
                    {
                        main.DemoSessions.RemoveRange(old);
                        await main.SaveChangesAsync(ct);
                    }
                }
            }
            finally
            {
                _lock.Release();
            }

            foreach (var name in toDrop)
                await DropAndMarkAsync(name, ct);

            if (fullSweep)
                await DropOrphansAsync(ct);

            await RefillPoolAsync(ct);
        }

        // Helpers

        private DateTime Activate(DemoSession session, DateTime nowUtc)
        {
            session.Status = DemoSessionStatus.Active;
            session.StartedAt = nowUtc;
            session.ExpiresAt = nowUtc.AddMinutes(_options.SessionMinutes);
            return session.ExpiresAt.Value;
        }

        private static Task<int> CountSeatsInUseAsync(Backend.Data.AppDbContext main, DateTime nowUtc, CancellationToken ct) =>
            main.DemoSessions.CountAsync(s =>
                !s.IsDropped &&
                (s.Status == DemoSessionStatus.Claimed ||
                 (s.Status == DemoSessionStatus.Active && s.ExpiresAt > nowUtc)), ct);

        private async Task<DemoResult> LoadRoleAsync(int sessionId, string databaseName, DateTime expiresAtUtc,
            string roleKey, ClientInfo client, int? previousLoginId, CancellationToken ct)
        {
            var role = Roles[roleKey];
            _alerts.Request(databaseName);

            await using var demo = _factory.CreateForDemo(databaseName);
            var user = await demo.Users.FirstOrDefaultAsync(u => u.Username == role.Username, ct);

            if (user == null || !user.IsActive)
                return DemoResult.Fail(409,
                    $"The {role.Label} account was removed or disabled during this demo. Exit and start a new demo to get it back.");

            return await CompleteSignInAsync(demo, user, sessionId, databaseName, expiresAtUtc, roleKey, role.Label,
                client, previousLoginId, ct);
        }

        // Every demo sign-in (first login, role switch, switch back, View as) is recorded exactly
        // like a normal login: last-login time, the same "Welcome back" notification in that
        // user's own inbox, and a sign-in row (Settings > Security) that the token points to.
        // The sign-in it replaces ends as "RoleSwitched".
        private static async Task<DemoResult> CompleteSignInAsync(Backend.Data.AppDbContext demo, User user,
            int sessionId, string databaseName, DateTime expiresAtUtc, string roleKey, string roleLabel,
            ClientInfo client, int? previousLoginId, CancellationToken ct)
        {
            var now = AppTime.Now;
            var utcNow = DateTime.UtcNow;
            user.LastLogin = now;

            if (previousLoginId != null)
            {
                var previous = await demo.LoginActivities.FirstOrDefaultAsync(a => a.LoginActivityID == previousLoginId, ct);
                if (previous != null && previous.EndedAt == null)
                {
                    previous.EndedAt = utcNow;
                    previous.EndReason = SessionEndReasons.RoleSwitched;
                }
            }

            var signIn = new LoginActivity
            {
                UserID = user.UserID,
                Username = user.Username.Length > 50 ? user.Username[..50] : user.Username,
                Result = LoginResults.SignedIn,
                IpAddress = client.IpAddress,
                UserAgent = client.UserAgent,
                CreatedAt = utcNow,
                LastSeenAt = utcNow,
                ExpiresAt = DateTime.SpecifyKind(expiresAtUtc, DateTimeKind.Utc)
            };
            demo.LoginActivities.Add(signIn);

            var muted = await demo.UserPreferences.AsNoTracking()
                .Where(p => p.UserID == user.UserID)
                .Select(p => p.MutedNotifications)
                .FirstOrDefaultAsync(ct);

            if (!NotificationCategories.IsMuted(muted, LoginNotification.Category))
            {
                demo.Notifications.Add(new Notification
                {
                    UserID = user.UserID,
                    Type = "Personal",
                    Category = LoginNotification.Category,
                    Title = LoginNotification.Title,
                    Message = LoginNotification.Message(now),
                    IsRead = false,
                    CreatedAt = now
                });
            }

            await demo.SaveChangesAsync(ct);

            return new DemoResult
            {
                Success = true,
                SessionId = sessionId,
                DatabaseName = databaseName,
                ExpiresAtUtc = DateTime.SpecifyKind(expiresAtUtc, DateTimeKind.Utc),
                RoleKey = roleKey,
                RoleLabel = roleLabel,
                User = user,
                LoginId = signIn.LoginActivityID
            };
        }

        // The session's end time, or null if it is no longer active.
        private async Task<DateTime?> GetActiveExpiryAsync(int sessionId, string databaseName, CancellationToken ct)
        {
            await using var main = _factory.CreateMain();
            var session = await main.DemoSessions.AsNoTracking()
                .FirstOrDefaultAsync(s => s.DemoSessionID == sessionId && s.DatabaseName == databaseName, ct);

            if (session == null || session.Status != DemoSessionStatus.Active ||
                session.ExpiresAt == null || session.ExpiresAt <= DateTime.UtcNow)
                return null;

            return session.ExpiresAt;
        }

        // Creates the schema straight from the current model (fast, and these databases are
        // throw-away, so they never need migration history) and fills in the demo company.
        private async Task<bool> BuildDatabaseAsync(string databaseName, CancellationToken ct)
        {
            try
            {
                await using var db = _factory.CreateForDemo(databaseName);
                await db.Database.EnsureCreatedAsync(ct);
                await DemoSeeder.SeedAsync(db, ct);
                return true;
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogError(ex, "Could not build demo database {Database}.", databaseName);
                return false;
            }
        }

        private async Task RefillPoolAsync(CancellationToken ct)
        {
            // Build one database at a time until the pool is full (or the server cap is reached).
            for (var attempt = 0; attempt < _options.ReadyPoolSize && !ct.IsCancellationRequested; attempt++)
            {
                DemoSession slot;

                await _lock.WaitAsync(ct);
                try
                {
                    await using var main = _factory.CreateMain();
                    var live = await main.DemoSessions
                        .Where(s => !s.IsDropped && s.Status != DemoSessionStatus.Ended)
                        .ToListAsync(ct);

                    var waiting = live.Count(s => s.Status == DemoSessionStatus.Ready || s.Status == DemoSessionStatus.Preparing);
                    if (waiting >= _options.ReadyPoolSize || live.Count >= _options.MaxVisitors + _options.ReadyPoolSize)
                        return;

                    slot = new DemoSession
                    {
                        DatabaseName = DemoDbFactory.NewDatabaseName(),
                        Status = DemoSessionStatus.Preparing,
                        CreatedAt = DateTime.UtcNow
                    };
                    main.DemoSessions.Add(slot);
                    await main.SaveChangesAsync(ct);
                }
                finally
                {
                    _lock.Release();
                }

                var built = await BuildDatabaseAsync(slot.DatabaseName, ct);
                var keep = false;

                await _lock.WaitAsync(CancellationToken.None);
                try
                {
                    await using var main = _factory.CreateMain();
                    var row = await main.DemoSessions.FirstAsync(s => s.DemoSessionID == slot.DemoSessionID);

                    if (built && row.Status == DemoSessionStatus.Preparing)
                    {
                        row.Status = DemoSessionStatus.Ready;
                        keep = true;
                    }
                    else
                    {
                        row.Status = DemoSessionStatus.Ended;
                        row.EndedAt ??= DateTime.UtcNow;
                    }

                    await main.SaveChangesAsync();
                }
                finally
                {
                    _lock.Release();
                }

                if (!keep)
                {
                    await DropAndMarkAsync(slot.DatabaseName, CancellationToken.None);
                    return;   // don't keep retrying a failing build every tick
                }
            }
        }

        // Removes visitor databases that exist on the server but have no live registry entry
        // (for example after a crash or a hard restart).
        private async Task DropOrphansAsync(CancellationToken ct)
        {
            List<string> onServer;
            HashSet<string> keep;

            await _lock.WaitAsync(ct);
            try
            {
                onServer = await _factory.ListDemoDatabasesAsync(ct);
                await using var main = _factory.CreateMain();
                keep = (await main.DemoSessions
                        .Where(s => !s.IsDropped && s.Status != DemoSessionStatus.Ended)
                        .Select(s => s.DatabaseName)
                        .ToListAsync(ct))
                    .ToHashSet();
            }
            finally
            {
                _lock.Release();
            }

            foreach (var name in onServer.Where(n => !keep.Contains(n)))
                await DropAndMarkAsync(name, ct);
        }

        private async Task DropAndMarkAsync(string databaseName, CancellationToken ct)
        {
            try
            {
                await _factory.DropDatabaseAsync(databaseName, ct);
                _alerts.Forget(databaseName);

                await using var main = _factory.CreateMain();
                var rows = await main.DemoSessions.Where(s => s.DatabaseName == databaseName).ToListAsync(ct);
                foreach (var row in rows) row.IsDropped = true;
                await main.SaveChangesAsync(ct);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                // Left as Ended and not dropped, so the next maintenance run tries again.
                _logger.LogWarning(ex, "Could not drop demo database {Database}; will retry.", databaseName);
            }
        }

        private static string CacheKey(int sessionId) => $"demo-session:{sessionId}";
    }
}
