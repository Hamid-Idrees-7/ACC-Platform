using Backend.Auth;

namespace Backend.Services
{
    // "Forgot password?" on the sign-in page: a one-time link by email.
    public interface IPasswordResetService
    {
        // Sends a link to every matching account that has an email. The caller always gets
        // the same answer, so it can't be used to find out which accounts exist.
        Task RequestAsync(string login, ClientInfo client);

        // Is the link still usable? Returns the account's username, or null.
        Task<string?> CheckAsync(string code);

        Task<(bool Success, string Message, string? Field)> ResetAsync(string code, string newPassword, ClientInfo client);
    }
}
