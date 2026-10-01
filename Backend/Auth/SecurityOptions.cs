namespace Backend.Auth
{
    // Fixed security rules for sign-in and sessions.
    public static class SecurityOptions
    {
        // Wrong passwords allowed for one username from one IP address before sign-in is
        // paused there. Other devices (other IP addresses) can still sign in.
        public const int MaxFailedAttempts = 5;
        public static readonly TimeSpan LockoutWindow = TimeSpan.FromMinutes(15);

        // A session is renewed while the user keeps working, but never beyond this:
        // after it, the user signs in again.
        public static readonly TimeSpan MaxSessionLength = TimeSpan.FromHours(12);

        // With "Keep me signed in" the session lasts this long from the sign-in.
        public static readonly TimeSpan KeepSignedInLength = TimeSpan.FromDays(30);

        // Forgot password: how long an email link works, and the shortest gap between
        // two emails for the same account.
        public static readonly TimeSpan ResetLinkLifetime = TimeSpan.FromMinutes(30);
        public static readonly TimeSpan ResetEmailGap = TimeSpan.FromMinutes(2);

        // "Last active" is written at most this often, not on every request.
        public static readonly TimeSpan LastSeenInterval = TimeSpan.FromMinutes(1);

        // Settings > Security shows this much sign-in history; older rows are deleted.
        public const int ActivityDays = 30;
        public const int KeepDays = 90;
        public const int ActivityRows = 25;

        // Automatic sign-out after inactivity (minutes). 0 = off.
        public static readonly int[] IdleChoices = { 0, 15, 30, 60 };
        public const int DefaultIdleMinutes = 30;

        // Rate limit on the sign-in endpoint, per IP address, across all usernames.
        public const string LoginRateLimitPolicy = "login";

        // Rate limit on the forgot / reset password endpoints, per IP address.
        public const string PasswordResetRateLimitPolicy = "password-reset";
    }

    // Marks an endpoint that works even when the caller's session has already ended
    // (signing out must always succeed).
    [AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
    public class SkipSessionCheckAttribute : Attribute
    {
    }
}
