using Backend.Auth;
using Backend.Models.DTOs;
using Backend.Models.Entities;

namespace Backend.Services
{
    // Sign-in protection (failed attempts), sessions (one per sign-in) and Settings > Security.
    public interface ISessionService
    {
        // When sign-in for this username from this IP opens again, or null if it is not paused.
        Task<DateTime?> GetLockoutEndAsync(string username, string? ipAddress);

        // Records a wrong password; returns how many failures now count towards the pause.
        Task<int> RecordFailureAsync(int? userId, string username, ClientInfo client);

        // Records an attempt that was refused for another reason (Blocked, Disabled).
        Task RecordAsync(int? userId, string username, string result, ClientInfo client);

        // A successful sign-in: creates the session the token will point to.
        Task<LoginActivity> StartAsync(User user, ClientInfo client);

        // Is the session behind a token still valid? Also keeps "last active" up to date.
        Task<SessionCheck> CheckAsync(int loginId, int userId);

        // Extends a session while the user keeps working; null when it can't be extended.
        Task<DateTime?> RenewAsync(int loginId, int userId);

        Task EndAsync(int loginId, int userId, string reason);

        // Signs out one of the user's other devices. False if it is not theirs or already ended.
        Task<bool> EndOtherAsync(int userId, int loginId, int? currentLoginId);

        // Signs out every session of the user (except one). Returns how many were ended.
        Task<int> EndAllAsync(int userId, int? exceptLoginId, string reason);

        Task<SecurityOverviewDto> GetOverviewAsync(int userId, int? currentLoginId);
    }

    // Result of a session check. Reason is set when the session is no longer valid.
    public record SessionCheck(bool Active, string? Reason)
    {
        public static readonly SessionCheck Ok = new(true, null);
        public static SessionCheck Ended(string reason) => new(false, reason);

        // Extra reasons besides SessionEndReasons
        public const string Expired = "Expired";
        public const string Disabled = "Disabled";
        public const string Missing = "Missing";

        // What the user reads on the sign-in page after being signed out.
        public static string MessageFor(string? reason) => reason switch
        {
            SessionEndReasons.SignedOutRemotely => "You were signed out from another device.",
            SessionEndReasons.PasswordChanged => "Your password was changed. Please sign in with the new password.",
            SessionEndReasons.AccountChanged => "Your account details were changed. Please sign in again.",
            SessionEndReasons.TimedOut => "You were signed out because of inactivity.",
            SessionEndReasons.SignedOut => "You have been signed out.",
            Disabled => "Your account is disabled. Please contact administration.",
            Expired => "Your session has expired. Please sign in again.",
            _ => "Your session has ended. Please sign in again."
        };
    }
}
