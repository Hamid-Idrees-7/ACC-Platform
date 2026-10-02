using Backend.Auth;
using Backend.Data;
using Backend.Models.DTOs;
using Backend.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace Backend.Services
{
    // Handles sign-in, token renewal and sign-out. Accounts are created on the Users page.
    public class AuthService : IAuthService
    {
        private readonly AppDbContext _context;
        private readonly TokenService _tokenService;
        private readonly INotificationService _notificationService;
        private readonly ISessionService _sessions;
        private readonly IAlertService _alerts;

        // Checked when the username does not exist, so a wrong username takes as long as a
        // wrong password (the timing does not reveal which usernames exist).
        private static readonly string DummyHash = BCrypt.Net.BCrypt.HashPassword("no-such-user-" + Guid.NewGuid());

        private const string InvalidCredentials = "Invalid username or password.";

        public AuthService(AppDbContext context, TokenService tokenService,
            INotificationService notificationService, ISessionService sessions, IAlertService alerts)
        {
            _context = context;
            _tokenService = tokenService;
            _notificationService = notificationService;
            _sessions = sessions;
            _alerts = alerts;
        }

        // Sign in. Every attempt is recorded (Settings > Security). After 5 wrong passwords for
        // one username from one IP address, sign-in from there is paused for 15 minutes.
        public async Task<LoginResult> LoginAsync(LoginDto dto, ClientInfo client)
        {
            var username = (dto.Username ?? string.Empty).Trim();
            if (username.Length == 0 || string.IsNullOrEmpty(dto.Password))
                return LoginResult.Fail(400, "Please enter both username and password.");

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Username == username);

            var pausedUntil = await _sessions.GetLockoutEndAsync(username, client.IpAddress);
            if (pausedUntil != null)
            {
                await _sessions.RecordAsync(user?.UserID, username, LoginResults.Blocked, client);
                var minutes = Math.Max(1, (int)Math.Ceiling((pausedUntil.Value - DateTime.UtcNow).TotalMinutes));
                return LoginResult.Fail(429,
                    $"Too many failed attempts. Please try again in {minutes} minute{(minutes == 1 ? "" : "s")}.");
            }

            var passwordOk = BCrypt.Net.BCrypt.Verify(dto.Password, user?.PasswordHash ?? DummyHash);
            if (user == null || !passwordOk)
            {
                var failures = await _sessions.RecordFailureAsync(user?.UserID, username, client);
                var left = SecurityOptions.MaxFailedAttempts - failures;

                if (left <= 0)
                {
                    if (user != null) await NotifyPausedAsync(user, client);
                    return LoginResult.Fail(429,
                        $"Too many failed attempts. Sign-in is paused for {SecurityOptions.LockoutWindow.TotalMinutes:0} minutes.");
                }

                // The last two tries get a warning.
                if (left <= 2)
                    return LoginResult.Fail(401,
                        $"{InvalidCredentials} {left} attempt{(left == 1 ? "" : "s")} left before sign-in is paused for {SecurityOptions.LockoutWindow.TotalMinutes:0} minutes.");

                return LoginResult.Fail(401, InvalidCredentials);
            }

            // Right password, but the account is disabled
            if (!user.IsActive)
            {
                await _sessions.RecordAsync(user.UserID, username, LoginResults.Disabled, client);
                return LoginResult.Fail(403, "Your account is disabled. Please contact administration.");
            }

            user.LastLogin = DateTime.Now;
            await _context.SaveChangesAsync();

            var session = await _sessions.StartAsync(user, client, dto.KeepSignedIn);

            await _notificationService.NotifyPersonalAsync(
                user.UserID, LoginNotification.Category, LoginNotification.Title,
                LoginNotification.Message(DateTime.Now));

            await _alerts.CheckNewDeviceAsync(user, client, session.LoginActivityID);

            return LoginResult.Ok(BuildAuthResponse(user, session.LoginActivityID, session.ExpiresAt!.Value));
        }

        // A fresh token for the same session while the user keeps working (the old one is
        // about to expire). Null when the session can't be extended any more.
        public async Task<AuthResponseDto?> RefreshAsync(int userId, int loginId)
        {
            var user = await _context.Users.FindAsync(userId);
            if (user == null || !user.IsActive) return null;

            var expiresAt = await _sessions.RenewAsync(loginId, userId);
            return expiresAt == null ? null : BuildAuthResponse(user, loginId, expiresAt.Value);
        }

        // Sign out: the session ends on the server too, so the token can't be used again.
        public Task LogoutAsync(int userId, int loginId, bool idle) =>
            _sessions.EndAsync(loginId, userId, idle ? SessionEndReasons.TimedOut : SessionEndReasons.SignedOut);

        // Tells the account owner that sign-in was paused, with where the attempts came from.
        private async Task NotifyPausedAsync(User user, ClientInfo client)
        {
            var device = DeviceInfo.From(client.UserAgent);
            var place = client.IpAddress == null ? "" : $" (IP {client.IpAddress})";
            await _notificationService.NotifyPersonalAsync(
                user.UserID, SecurityNotification.Category, "Sign-in paused",
                $"{SecurityOptions.MaxFailedAttempts} wrong passwords were entered for your account from " +
                $"{device.Browser} on {device.Os}{place}. Sign-in from there is paused for " +
                $"{SecurityOptions.LockoutWindow.TotalMinutes:0} minutes. If this wasn't you, change your password " +
                "in Settings > Account Management.", link: NotificationLinks.Security);
        }

        private AuthResponseDto BuildAuthResponse(User user, int loginId, DateTime expiresAtUtc)
        {
            return new AuthResponseDto
            {
                Token = _tokenService.CreateToken(user, loginId, expiresAtUtc),
                UserID = user.UserID,
                Username = user.Username,
                FullName = user.FullName,
                Role = user.Role,
                ProfilePicture = user.ProfilePicture
            };
        }
    }

    // Result of a sign-in attempt: the auth data, or the status code and message to return.
    public record LoginResult(bool Success, int StatusCode, string? Error, AuthResponseDto? Data)
    {
        public static LoginResult Ok(AuthResponseDto data) => new(true, 200, null, data);
        public static LoginResult Fail(int statusCode, string error) => new(false, statusCode, error, null);
    }

    // Category of security notifications (sign-in paused, and so on).
    public static class SecurityNotification
    {
        public const string Category = "Security";
    }
}
