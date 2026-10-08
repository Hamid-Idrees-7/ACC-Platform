namespace Backend.Ai
{
    // AI settings (appsettings "Ai"). The key is never in the repository: it comes from
    // User Secrets in development, or the host's environment settings in production.
    // Switching provider is a config change, not a code change: set Provider and the key.
    public class AiOptions
    {
        public bool Enabled { get; set; } = true;

        // "gemini" for now. Later "claude" or "openai" without touching the callers.
        public string Provider { get; set; } = "gemini";

        // A free-tier Gemini model that supports tool calling.
        public string Model { get; set; } = "gemini-3.5-flash-lite";

        public string ApiKey { get; set; } = "";
    }
}
