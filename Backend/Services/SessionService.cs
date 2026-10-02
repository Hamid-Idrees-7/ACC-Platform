using Backend.Auth;
using Backend.Models.DTOs;
using Backend.Models.Entities;
using Backend.Repositories;

namespace Backend.Services
{
    public class SessionService : ISessionService
    {
        private readonly ILoginActivityRepository _repository;
        private readonly IUserRepository _users;
        private readonly IPreferenceRepository _preferences;
        private readonly TimeSpan _tokenLifetime;

        public SessionService(ILoginActivityRepository repository, IUserRepository users, IPreferenceRepository preferences, IConfiguration config)
        {
            _repository = repository;
            _users = users;
            _preferences = preferences;
            _tokenLifetime = TimeSpan.FromMinutes(double.TryParse(config["Jwt:ExpiryMinutes"], out var minutes) ? minutes : 120);
        }

        // Sign-in protection

        // Wrong passwords that still count: the last 15 minutes, and only after the last
        // successful sign-in from the same place.
        private async Task<List<DateTime>> CountingFailuresAsync(string username, string? ipAddress)
        {
            var since = DateTime.UtcNow - SecurityOptions.LockoutWindow;
            var lastSuccess = await _repository.GetLastSuccessAsync(username, ipAddress);
            if (lastSuccess != null && lastSuccess.Value > since) since = lastSuccess.Value;
            return await _repository.GetFailureTimesAsync(username, ipAddress, since);
        }

        public async Task<DateTime?> GetLockoutEndAsync(string username, string? ipAddress)
        {
            var failures = await CountingFailuresAsync(username, ipAddress);
            if (failures.Count < SecurityOptions.MaxFailedAttempts) return null;

            // Paused until 15 minutes after the failure that reached the limit.
            var end = failures[SecurityOptions.MaxFailedAttempts - 1] + SecurityOptions.LockoutWindow;
            return end > DateTime.UtcNow ? DateTime.SpecifyKind(end, DateTimeKind.Utc) : null;
        }

        public async Task<int> RecordFailureAsync(int? userId, string username, ClientInfo client)
        {
            await RecordAsync(userId, username, LoginResults.WrongPassword, client);
            return (await CountingFailuresAsync(username, client.IpAddress)).Count;
        }

        public async Task RecordAsync(int? userId, string username, string result, ClientInfo client)
        {
            await _repository.AddAsync(new LoginActivity
            {
                UserID = userId,
                Username = Cut(username, 50),
                Result = result,
                IpAddress = client.IpAddress,
                UserAgent = client.UserAgent,
                CreatedAt = DateTime.UtcNow
            });
        }

        // Sessions

        public async Task<LoginActivity> StartAsync(User user, ClientInfo client, bool keepSignedIn)
        {
            var now = DateTime.UtcNow;
            var session = new LoginActivity
            {
                UserID = user.UserID,
                Username = Cut(user.Username, 50),
                Result = LoginResults.SignedIn,
                IpAddress = client.IpAddress,
                UserAgent = client.UserAgent,
                CreatedAt = now,
                LastSeenAt = now,
                ExpiresAt = now + (keepSignedIn ? SecurityOptions.KeepSignedInLength : _tokenLifetime),
                KeepSignedIn = keepSignedIn
            };
            await _repository.AddAsync(session);

            // Keep the table small: history older than 90 days is removed.
            await _repository.PurgeAsync(now.AddDays(-SecurityOptions.KeepDays));

            return session;
        }

        public async Task<SessionCheck> CheckAsync(int loginId, int userId)
        {
            var session = await _repository.GetAsync(loginId);
            if (session == null || session.UserID != userId || session.Result != LoginResults.SignedIn)
                return SessionCheck.Ended(SessionCheck.Missing);

            if (session.EndedAt != null)
                return SessionCheck.Ended(session.EndReason ?? SessionEndReasons.SignedOut);

            var now = DateTime.UtcNow;
            if (session.ExpiresAt == null || session.ExpiresAt <= now)
                return SessionCheck.Ended(SessionCheck.Expired);

            var isActive = await _users.GetIsActiveAsync(userId);
            if (isActive == null)
                return SessionCheck.Ended(SessionCheck.Missing);

            if (isActive == false)
            {
                session.EndedAt = now;
                session.EndReason = SessionEndReasons.AccountChanged;
                await _repository.SaveChangesAsync();
                return SessionCheck.Ended(SessionCheck.Disabled);
            }

            // The browser signs out an idle tab itself. This catches a token used again after
            // a long silence (eg copied from another device), using the same setting plus a margin.
            // "Remember me" sessions are meant to survive a closed browser, so they are left out.
            var idleLimit = session.KeepSignedIn ? null : await IdleLimitAsync(userId);
            if (idleLimit != null && session.LastSeenAt != null && now - session.LastSeenAt.Value > idleLimit.Value)
            {
                session.EndedAt = now;
                session.EndReason = SessionEndReasons.TimedOut;
                await _repository.SaveChangesAsync();
                return SessionCheck.Ended(SessionEndReasons.TimedOut);
            }

            if (session.LastSeenAt == null || now - session.LastSeenAt.Value >= SecurityOptions.LastSeenInterval)
            {
                session.LastSeenAt = now;
                await _repository.SaveChangesAsync();
            }

            return SessionCheck.Ok;
        }

        private async Task<TimeSpan?> IdleLimitAsync(int userId)
        {
            var minutes = (await _preferences.GetAsync(userId))?.IdleMinutes ?? SecurityOptions.DefaultIdleMinutes;
            if (minutes <= 0) return null;
            return TimeSpan.FromMinutes(minutes) + SecurityOptions.IdleServerMargin;
        }

        public async Task<DateTime?> RenewAsync(int loginId, int userId)
        {
            var session = await _repository.GetAsync(loginId);
            var now = DateTime.UtcNow;
            if (session == null || session.UserID != userId || session.EndedAt != null ||
                session.ExpiresAt == null || session.ExpiresAt <= now)
                return null;

            // Never past 12 hours from the sign-in (30 days with "Keep me signed in").
            var limit = session.CreatedAt + (session.KeepSignedIn ? SecurityOptions.KeepSignedInLength : SecurityOptions.MaxSessionLength);
            var next = now + _tokenLifetime;
            if (next > limit) next = limit;
            if (next <= session.ExpiresAt.Value) return null;

            session.ExpiresAt = next;
            session.LastSeenAt = now;
            await _repository.SaveChangesAsync();
            return DateTime.SpecifyKind(next, DateTimeKind.Utc);
        }

        public async Task EndAsync(int loginId, int userId, string reason)
        {
            var session = await _repository.GetAsync(loginId);
            if (session == null || session.UserID != userId || session.EndedAt != null) return;

            session.EndedAt = DateTime.UtcNow;
            session.EndReason = reason;
            await _repository.SaveChangesAsync();
        }

        public async Task<bool> EndOtherAsync(int userId, int loginId, int? currentLoginId)
        {
            if (loginId == currentLoginId) return false;

            var session = await _repository.GetAsync(loginId);
            var now = DateTime.UtcNow;
            if (session == null || session.UserID != userId || session.Result != LoginResults.SignedIn ||
                session.EndedAt != null || session.ExpiresAt == null || session.ExpiresAt <= now)
                return false;

            session.EndedAt = now;
            session.EndReason = SessionEndReasons.SignedOutRemotely;
            await _repository.SaveChangesAsync();
            return true;
        }

        public Task<int> EndAllAsync(int userId, int? exceptLoginId, string reason) =>
            _repository.EndSessionsAsync(userId, exceptLoginId, reason, DateTime.UtcNow);

        // Settings > Security

        public async Task<SecurityOverviewDto> GetOverviewAsync(int userId, int? currentLoginId)
        {
            var now = DateTime.UtcNow;
            var open = await _repository.GetOpenSessionsAsync(userId, now);
            var recent = await _repository.GetRecentAsync(userId, now.AddDays(-SecurityOptions.ActivityDays), SecurityOptions.ActivityRows);

            return new SecurityOverviewDto
            {
                // This device first, then the most recently used.
                Sessions = open
                    .Select(s => ToDto(s, now, currentLoginId))
                    .OrderByDescending(s => s.IsCurrent)
                    .ThenByDescending(s => s.LastSeenAt ?? s.At)
                    .ToList(),
                Activity = recent.Select(a => ToDto(a, now, currentLoginId)).ToList(),
                ActivityDays = SecurityOptions.ActivityDays
            };
        }

        private static LoginSessionDto ToDto(LoginActivity a, DateTime nowUtc, int? currentLoginId)
        {
            var device = DeviceInfo.From(a.UserAgent);
            return new LoginSessionDto
            {
                Id = a.LoginActivityID,
                Result = a.Result,
                Browser = device.Browser,
                Os = device.Os,
                DeviceKind = device.Kind,
                IpAddress = DisplayIp(a.IpAddress),
                At = Utc(a.CreatedAt),
                LastSeenAt = a.LastSeenAt == null ? null : Utc(a.LastSeenAt.Value),
                EndedAt = a.EndedAt == null ? null : Utc(a.EndedAt.Value),
                EndReason = a.EndReason,
                IsActive = a.Result == LoginResults.SignedIn && a.EndedAt == null && a.ExpiresAt > nowUtc,
                IsCurrent = a.LoginActivityID == currentLoginId
            };
        }

        // The database stores UTC; say so, so the browser shows the user's local time.
        private static DateTime Utc(DateTime value) => DateTime.SpecifyKind(value, DateTimeKind.Utc);

        private static string? DisplayIp(string? ip) => ip switch
        {
            null => null,
            "::1" or "127.0.0.1" => "This computer (localhost)",
            _ => ip
        };

        private static string Cut(string value, int max) => value.Length > max ? value[..max] : value;
    }
}
