using System.Net;
using System.Security.Cryptography;
using System.Text;
using Backend.Auth;
using Backend.Demo;
using Backend.Email;
using Backend.Models.Entities;
using Backend.Repositories;

namespace Backend.Services
{
    public class PasswordResetService : IPasswordResetService
    {
        private readonly IPasswordResetRepository _repository;
        private readonly ICompanySettingsRepository _company;
        private readonly ISessionService _sessions;
        private readonly INotificationService _notifications;
        private readonly IEmailSender _email;
        private readonly IConfiguration _config;
        private readonly IWebHostEnvironment _env;
        private readonly ILogger<PasswordResetService> _logger;

        public PasswordResetService(IPasswordResetRepository repository, ICompanySettingsRepository company,
            ISessionService sessions, INotificationService notifications, IEmailSender email,
            IConfiguration config, IWebHostEnvironment env, ILogger<PasswordResetService> logger)
        {
            _repository = repository;
            _company = company;
            _sessions = sessions;
            _notifications = notifications;
            _email = email;
            _config = config;
            _env = env;
            _logger = logger;
        }

        public async Task RequestAsync(string login, ClientInfo client)
        {
            if (string.IsNullOrWhiteSpace(login) || login.Length > 100) return;

            var now = DateTime.UtcNow;
            await _repository.PurgeAsync(now.AddDays(-1));

            var accounts = await _repository.FindAccountsAsync(login);
            foreach (var user in accounts)
            {
                if (string.IsNullOrWhiteSpace(user.Email) || DemoSeeder.IsBuiltInLogin(user.Username)) continue;

                // One email every 2 minutes per account, so the button can't flood an inbox.
                var last = await _repository.GetLastRequestAsync(user.UserID);
                if (last != null && now - last.Value < SecurityOptions.ResetEmailGap) continue;

                var code = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
                    .TrimEnd('=').Replace('+', '-').Replace('/', '_');
                await _repository.AddAsync(new PasswordReset
                {
                    UserID = user.UserID,
                    CodeHash = Hash(code),
                    CreatedAt = now,
                    ExpiresAt = now + SecurityOptions.ResetLinkLifetime,
                    RequestedFromIp = client.IpAddress
                });

                var link = $"{FrontendUrl()}/reset-password?code={code}";
                var companyName = (await _company.GetAsync())?.CompanyName ?? CompanyOptions.DefaultName;

                if (!_email.IsConfigured)
                {
                    // Local testing without a mail account: the link is written to the console.
                    if (_env.IsDevelopment())
                        _logger.LogWarning("Email is not set up. Password reset link for {Username}: {Link}", user.Username, link);
                    else
                        _logger.LogError("Email is not set up, so the password reset email for {Username} was not sent.", user.Username);
                    continue;
                }

                // Sent in the background: the answer takes the same time whether an account
                // matched or not.
                var (subject, html, text) = ResetEmail(user, link, companyName);
                _ = SendInBackground(user.Email, user.Username, subject, html, text);
            }
        }

        public async Task<string?> CheckAsync(string code)
        {
            var (reset, user) = await FindUsableAsync(code);
            return reset == null ? null : user!.Username;
        }

        public async Task<(bool Success, string Message, string? Field)> ResetAsync(string code, string newPassword, ClientInfo client)
        {
            var (reset, user) = await FindUsableAsync(code);
            if (reset == null || user == null)
                return (false, "This link has expired or was already used. Please ask for a new one.", "code");

            var passwordError = PasswordPolicy.Validate(newPassword);
            if (passwordError != null) return (false, passwordError, "password");

            if (BCrypt.Net.BCrypt.Verify(newPassword, user.PasswordHash))
                return (false, "New password must be different from your current password.", "password");

            // Two requests with the same link at the same moment: only the first one goes through.
            if (!await _repository.TryUseAsync(reset.PasswordResetID, DateTime.UtcNow))
                return (false, "This link has expired or was already used. Please ask for a new one.", "code");

            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(newPassword);
            user.UpdatedAt = AppTime.Now;
            await _repository.SaveChangesAsync();

            // Whoever knew the old password is signed out everywhere.
            await _sessions.EndAllAsync(user.UserID, null, SessionEndReasons.PasswordChanged);
            await _sessions.RecordAsync(user.UserID, user.Username, LoginResults.PasswordReset, client);

            var device = DeviceInfo.From(client.UserAgent);
            var place = client.IpAddress == null ? "" : $" (IP {client.IpAddress})";
            await _notifications.NotifyPersonalAsync(
                user.UserID, SecurityNotification.Category, "Password reset",
                $"Your password was reset with the link sent to your email, from {device.Browser} on {device.Os}{place}. " +
                "All devices were signed out. If this wasn't you, contact your administrator.");

            return (true, "Password changed. You can sign in with your new password.", null);
        }

        private async Task<(PasswordReset? Reset, User? User)> FindUsableAsync(string code)
        {
            if (string.IsNullOrWhiteSpace(code) || code.Length > 100) return (null, null);

            var reset = await _repository.GetByHashAsync(Hash(code));
            if (reset == null || reset.UsedAt != null || reset.ExpiresAt <= DateTime.UtcNow) return (null, null);

            var user = await _repository.GetUserAsync(reset.UserID);
            if (user == null || !user.IsActive || DemoSeeder.IsBuiltInLogin(user.Username)) return (null, null);

            return (reset, user);
        }

        private async Task SendInBackground(string to, string username, string subject, string html, string text)
        {
            await Task.Yield();
            try
            {
                await _email.SendAsync(to, subject, html, text);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Password reset email for {Username} could not be sent.", username);
            }
        }

        // The first address when several are configured (the rest are only for CORS).
        private string FrontendUrl() =>
            (_config["App:FrontendUrl"] ?? "http://localhost:5173").Split(',')[0].Trim().TrimEnd('/');

        private static string Hash(string code) =>
            Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(code)));

        private static (string Subject, string Html, string Text) ResetEmail(User user, string link, string company)
        {
            var minutes = (int)SecurityOptions.ResetLinkLifetime.TotalMinutes;
            var name = string.IsNullOrWhiteSpace(user.FullName) ? user.Username : user.FullName;
            var subject = $"Reset your {company} password";

            var text =
                $"Hi {name},\n\n" +
                $"Someone asked to reset the password for the account \"{user.Username}\". " +
                $"Open this link to choose a new password. It works once, for {minutes} minutes:\n\n{link}\n\n" +
                "If you didn't ask for this, you can ignore this email. Your password stays the same.\n\n" +
                company;

            var h = (string s) => WebUtility.HtmlEncode(s);
            var html = $@"<!doctype html>
<html><body style=""margin:0;padding:24px;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:#1f2937"">
<table role=""presentation"" width=""100%"" cellpadding=""0"" cellspacing=""0""><tr><td align=""center"">
<table role=""presentation"" width=""480"" cellpadding=""0"" cellspacing=""0"" style=""max-width:480px;background:#ffffff;border-radius:12px;padding:32px"">
<tr><td>
<p style=""margin:0 0 20px;font-size:13px;font-weight:bold;letter-spacing:1px;color:#F66435"">{h(company.ToUpperInvariant())}</p>
<h1 style=""margin:0 0 16px;font-size:20px"">Reset your password</h1>
<p style=""margin:0 0 12px;font-size:15px;line-height:1.5"">Hi {h(name)},</p>
<p style=""margin:0 0 24px;font-size:15px;line-height:1.5"">Someone asked to reset the password for the account <strong>{h(user.Username)}</strong>. The button works once, for {minutes} minutes.</p>
<p style=""margin:0 0 24px""><a href=""{h(link)}"" style=""display:inline-block;background:#F66435;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:8px"">Choose a new password</a></p>
<p style=""margin:0 0 8px;font-size:13px;color:#6b7280"">Or copy this link into your browser:</p>
<p style=""margin:0 0 24px;font-size:13px;word-break:break-all""><a href=""{h(link)}"" style=""color:#F66435"">{h(link)}</a></p>
<p style=""margin:0;font-size:13px;color:#6b7280;line-height:1.5"">If you didn't ask for this, you can ignore this email. Your password stays the same.</p>
</td></tr></table>
</td></tr></table>
</body></html>";

            return (subject, html, text);
        }
    }
}
