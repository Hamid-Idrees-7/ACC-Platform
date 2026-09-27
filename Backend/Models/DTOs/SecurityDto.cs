namespace Backend.Models.DTOs
{
    // Settings > Security: open sessions and sign-in history of one user.
    public class SecurityOverviewDto
    {
        public List<LoginSessionDto> Sessions { get; set; } = new();
        public List<LoginSessionDto> Activity { get; set; } = new();
        public int ActivityDays { get; set; }
    }

    // One sign-in (and, when it succeeded, its session). Times are UTC.
    public class LoginSessionDto
    {
        public int Id { get; set; }

        // SignedIn, WrongPassword, Blocked or Disabled
        public string Result { get; set; } = string.Empty;

        public string Browser { get; set; } = string.Empty;
        public string Os { get; set; } = string.Empty;

        // desktop, phone or tablet
        public string DeviceKind { get; set; } = "desktop";

        public string? IpAddress { get; set; }
        public DateTime At { get; set; }
        public DateTime? LastSeenAt { get; set; }
        public DateTime? EndedAt { get; set; }
        public string? EndReason { get; set; }

        // Still signed in (not ended, not expired)
        public bool IsActive { get; set; }

        // The session this request is made from
        public bool IsCurrent { get; set; }
    }

    // POST /api/auth/logout: why the user was signed out ("idle" after inactivity).
    public class LogoutDto
    {
        public string? Reason { get; set; }
    }
}
