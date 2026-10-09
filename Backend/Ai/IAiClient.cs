using System.Text.Json;

namespace Backend.Ai
{
    // One turn in a conversation. Role is "user" (the person) or "model" (the AI).
    public record AiMessage(string Role, string Text);

    // One reply from the AI. Ok is false when the call failed, with a short Error to log.
    public record AiReply(bool Ok, string Text, string? Error = null);

    // A tool the AI may call. Parameters is a JSON-schema object describing the arguments.
    // Handler runs our own code (eg work out a cost, save an inquiry) and returns a result
    // that the AI reads before writing its reply. This is how the AI uses real data, not guesses.
    public record AiTool(
        string Name,
        string Description,
        object Parameters,
        Func<JsonElement, CancellationToken, Task<object>> Handler);

    // The one way the rest of the app talks to any AI provider. A system prompt sets the role,
    // the history carries earlier turns, userMessage is the new question, and tools (if any) are
    // the actions the AI may take. The client runs the tool loop and returns the final text.
    public interface IAiClient
    {
        string Provider { get; }
        string Model { get; }

        Task<AiReply> ChatAsync(string systemPrompt, IReadOnlyList<AiMessage> history, string userMessage,
            IReadOnlyList<AiTool> tools, CancellationToken ct = default);
    }
}
