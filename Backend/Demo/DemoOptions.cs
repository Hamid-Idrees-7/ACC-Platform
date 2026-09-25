namespace Backend.Demo
{
    // Settings for the public visitor demo (appsettings.json to Demo).
    public class DemoOptions
    {
        // Master switch. When false the visitor buttons are hidden and no demo databases are built.
        public bool Enabled { get; set; } = false;

        // Maximum number of visitors exploring the demo at the same time.
        public int MaxVisitors { get; set; } = 5;

        // Pre-built databases kept waiting so the next visitor gets in instantly.
        public int ReadyPoolSize { get; set; } = 2;

        // Length of one visitor session. The visitor's database is dropped when it ends.
        public int SessionMinutes { get; set; } = 30;

        // Every N hours: rebuild the waiting pool from the latest seed and remove leftover databases.
        public int SweepHours { get; set; } = 6;

        // Name of the rate-limit policy applied to starting a demo.
        public const string StartRateLimitPolicy = "demo-start";
    }

    // Claim names carried inside a visitor's (signed) token.
    public static class DemoClaims
    {
        public const string SessionId = "demo_sid";
        public const string Database = "demo_db";
        public const string Role = "demo_role";
    }

    // Lifecycle states of a visitor database (see DemoSession).
    public static class DemoSessionStatus
    {
        public const string Preparing = "Preparing";
        public const string Ready = "Ready";
        public const string Claimed = "Claimed";
        public const string Active = "Active";
        public const string Ended = "Ended";
    }

    // Marks an endpoint that must always use the real (main) database, even when the caller
    // still carries a demo token, e.g. the public contact form and the normal sign-in.
    [AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
    public class UseMainDatabaseAttribute : Attribute
    {
    }
}
