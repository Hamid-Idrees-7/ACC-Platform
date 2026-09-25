namespace Backend.Models.DTOs
{
    // Visitor picks a role when starting the demo or switching inside it: admin / manager / engineer.
    public class DemoRoleDto
    {
        public string? Role { get; set; }
    }

    // Same shape as a normal sign-in response, plus the demo details the frontend needs.
    public class DemoAuthResponseDto : AuthResponseDto
    {
        public bool IsDemo { get; set; } = true;

        // "admin" / "manager" / "engineer", or "custom" when viewing as a visitor-created user.
        public string DemoRole { get; set; } = string.Empty;

        // Display name for the role (e.g. "Manager", or the custom user's full name).
        public string DemoRoleLabel { get; set; } = string.Empty;

        // Seconds left in the session. Sent as a duration (not a clock time) so the countdown
        // stays correct even if the visitor's computer clock is off.
        public int DemoSecondsLeft { get; set; }
    }

    // Whether the login page should offer the demo, and whether a seat is free right now.
    public class DemoStatusDto
    {
        public bool Enabled { get; set; }
        public bool Available { get; set; }
        public int SessionMinutes { get; set; }
    }
}
