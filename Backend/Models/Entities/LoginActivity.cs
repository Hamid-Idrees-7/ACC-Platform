using System.ComponentModel.DataAnnotations;

namespace Backend.Models.Entities
{
    // One sign-in attempt (Settings > Security). A successful attempt is also a session:
    // the token carries its ID, so it can be signed out on its own ("Sign out" on one device)
    // or together with the others (password change, "Sign out all other devices").
    // All times are UTC.
    public class LoginActivity
    {
        [Key]
        public int LoginActivityID { get; set; }

        // The account, when the username belongs to one (null for an unknown username).
        public int? UserID { get; set; }

        // The username as it was typed, so repeated failures can be counted even for
        // usernames that do not exist (the answer never tells which one it was).
        [Required]
        [MaxLength(50)]
        public string Username { get; set; } = string.Empty;

        // SignedIn, WrongPassword, Blocked or Disabled (see LoginResults)
        [Required]
        [MaxLength(20)]
        public string Result { get; set; } = string.Empty;

        [MaxLength(45)]
        public string? IpAddress { get; set; }

        [MaxLength(300)]
        public string? UserAgent { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Session fields, only for Result = SignedIn.
        // ExpiresAt moves forward each time the token is renewed.
        public DateTime? ExpiresAt { get; set; }
        public DateTime? LastSeenAt { get; set; }
        public DateTime? EndedAt { get; set; }

        // Why the session ended: SignedOut, TimedOut, SignedOutRemotely, PasswordChanged,
        // AccountChanged or RoleSwitched (see SessionEndReasons)
        [MaxLength(30)]
        public string? EndReason { get; set; }
    }

    public static class LoginResults
    {
        public const string SignedIn = "SignedIn";
        public const string WrongPassword = "WrongPassword";
        public const string Blocked = "Blocked";
        public const string Disabled = "Disabled";
    }

    public static class SessionEndReasons
    {
        public const string SignedOut = "SignedOut";
        public const string TimedOut = "TimedOut";
        public const string SignedOutRemotely = "SignedOutRemotely";
        public const string PasswordChanged = "PasswordChanged";
        public const string AccountChanged = "AccountChanged";
        public const string RoleSwitched = "RoleSwitched";
    }
}
