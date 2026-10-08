namespace Backend.Ai
{
    // One turn in a conversation. Role is "user" (the person) or "model" (the AI).
    public record AiMessage(string Role, string Text);

    // One reply from the AI. Ok is false when the call failed, with a short Error to log.
    public record AiReply(bool Ok, string Text, string? Error = null);

    // The one way the rest of the app talks to any AI provider. A system prompt sets the role,
    // the history carries earlier turns, and userMessage is the new question.
    public interface IAiClient
    {
        string Provider { get; }
        string Model { get; }

        Task<AiReply> ChatAsync(string systemPrompt, IReadOnlyList<AiMessage> history, string userMessage, CancellationToken ct = default);
    }
}
