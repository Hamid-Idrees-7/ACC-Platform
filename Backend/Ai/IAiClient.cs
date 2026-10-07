namespace Backend.Ai
{
    // One reply from the AI. Ok is false when the call failed, with a short Error to log.
    public record AiReply(bool Ok, string Text, string? Error = null);

    // The one way the rest of the app talks to any AI provider. Phase 0 sends a plain
    // message and gets text back. Tools and history come in later phases.
    public interface IAiClient
    {
        string Provider { get; }
        string Model { get; }

        Task<AiReply> SendAsync(string systemPrompt, string userMessage, CancellationToken ct = default);
    }
}
