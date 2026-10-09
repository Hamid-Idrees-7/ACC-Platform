using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;

namespace Backend.Ai
{
    // Talks to Google Gemini over its REST API. We call the raw endpoint ourselves (no SDK),
    // so the data flow stays visible: build a request, post it, read the reply, and when the
    // model asks for a tool, run it and send the result back.
    public class GeminiClient : IAiClient
    {
        private const string BaseUrl = "https://generativelanguage.googleapis.com/v1beta/models";
        private const int MaxAttempts = 3;     // one try, then two retries for "busy" replies
        private const int MaxToolRounds = 5;   // stop runaway tool loops

        private readonly IHttpClientFactory _httpFactory;
        private readonly AiOptions _options;
        private readonly ILogger<GeminiClient> _logger;

        public GeminiClient(IHttpClientFactory httpFactory, IOptions<AiOptions> options, ILogger<GeminiClient> logger)
        {
            _httpFactory = httpFactory;
            _options = options.Value;
            _logger = logger;
        }

        public string Provider => "gemini";
        public string Model => _options.Model;

        public async Task<AiReply> ChatAsync(string systemPrompt, IReadOnlyList<AiMessage> history, string userMessage,
            IReadOnlyList<AiTool> tools, CancellationToken ct = default)
        {
            if (string.IsNullOrWhiteSpace(_options.ApiKey))
                return new AiReply(false, "", "AI key is not set. Add Ai:ApiKey to User Secrets.");

            // The running conversation: earlier turns, then the new question. It grows as the
            // model asks for tools and we add the results.
            var contents = new List<object>();
            foreach (var turn in history)
                contents.Add(TextTurn(turn.Role == "model" ? "model" : "user", turn.Text));
            contents.Add(TextTurn("user", userMessage));

            object? toolsJson = tools.Count == 0 ? null : new object[]
            {
                new { functionDeclarations = tools.Select(t => new { name = t.Name, description = t.Description, parameters = t.Parameters }) }
            };

            for (var round = 0; round < MaxToolRounds; round++)
            {
                var bodyObj = new Dictionary<string, object?>
                {
                    ["systemInstruction"] = new { parts = new[] { new { text = systemPrompt } } },
                    ["contents"] = contents
                };
                if (toolsJson != null) bodyObj["tools"] = toolsJson;

                var (ok, json, error) = await PostAsync(JsonSerializer.Serialize(bodyObj), ct);
                if (!ok) return new AiReply(false, "", error);

                using var doc = JsonDocument.Parse(json);
                if (!doc.RootElement.TryGetProperty("candidates", out var candidates) || candidates.GetArrayLength() == 0)
                    return new AiReply(false, "", "AI service returned no answer.");

                if (!candidates[0].TryGetProperty("content", out var content) ||
                    !content.TryGetProperty("parts", out var parts))
                    return new AiReply(false, "", "AI service returned no answer.");

                // Collect any tool requests in this reply.
                var calls = parts.EnumerateArray().Where(p => p.TryGetProperty("functionCall", out _)).ToList();
                if (calls.Count == 0)
                {
                    var text = TextOf(parts);
                    return text == null ? new AiReply(false, "", "AI service returned no text.") : new AiReply(true, text);
                }

                // Run each requested tool and collect the results. We send the model's own turn
                // back unchanged (it carries a thought_signature the newer models require), then
                // add our results, and loop so the model can use them.
                var resultParts = new List<object>();
                foreach (var call in calls)
                {
                    var fc = call.GetProperty("functionCall");
                    var name = fc.TryGetProperty("name", out var n) ? n.GetString() ?? "" : "";
                    var args = fc.TryGetProperty("args", out var a) ? a.Clone() : default;
                    string? id = fc.TryGetProperty("id", out var idEl) ? idEl.GetString() : null;

                    object result;
                    var tool = tools.FirstOrDefault(t => t.Name == name);
                    if (tool == null)
                    {
                        result = new { error = "Unknown tool." };
                    }
                    else
                    {
                        try { result = await tool.Handler(args, ct) ?? new { }; }
                        catch (OperationCanceledException) when (ct.IsCancellationRequested) { throw; }
                        catch (Exception ex) { _logger.LogError(ex, "AI tool {Tool} failed", name); result = new { error = "The tool failed." }; }
                    }

                    var respObj = new Dictionary<string, object?> { ["name"] = name, ["response"] = new { result } };
                    if (id != null) respObj["id"] = id;
                    resultParts.Add(new Dictionary<string, object?> { ["functionResponse"] = respObj });
                }

                contents.Add(content.Clone());
                contents.Add(new Dictionary<string, object?> { ["role"] = "user", ["parts"] = resultParts });
            }

            return new AiReply(false, "", "AI could not finish the request.");
        }

        private static object TextTurn(string role, string text) =>
            new Dictionary<string, object?> { ["role"] = role, ["parts"] = new[] { new { text } } };

        private static string? TextOf(JsonElement parts)
        {
            var sb = new StringBuilder();
            foreach (var part in parts.EnumerateArray())
                if (part.TryGetProperty("text", out var t))
                    sb.Append(t.GetString());
            var text = sb.ToString().Trim();
            return text.Length == 0 ? null : text;
        }

        // One POST to Gemini, with retries for temporary "busy" replies (503) and rate limits (429).
        private async Task<(bool Ok, string Json, string? Error)> PostAsync(string body, CancellationToken ct)
        {
            var url = $"{BaseUrl}/{_options.Model}:generateContent";
            var http = _httpFactory.CreateClient("ai");
            string? lastReason = null;

            for (var attempt = 1; attempt <= MaxAttempts; attempt++)
            {
                try
                {
                    using var request = new HttpRequestMessage(HttpMethod.Post, url);
                    request.Headers.Add("x-goog-api-key", _options.ApiKey);
                    request.Content = new StringContent(body, Encoding.UTF8, "application/json");

                    using var response = await http.SendAsync(request, ct);
                    var json = await response.Content.ReadAsStringAsync(ct);

                    if (response.IsSuccessStatusCode)
                        return (true, json, null);

                    var status = (int)response.StatusCode;
                    lastReason = ReadError(json);
                    _logger.LogWarning("Gemini call failed (attempt {Attempt}): {Status} {Body}", attempt, status, json);

                    if ((status == 503 || status == 429) && attempt < MaxAttempts)
                    {
                        await Task.Delay(TimeSpan.FromMilliseconds(600 * attempt), ct);
                        continue;
                    }
                    return (false, "", $"AI service returned {status}{(lastReason != null ? ": " + lastReason : ".")}");
                }
                catch (OperationCanceledException) when (ct.IsCancellationRequested)
                {
                    throw;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Gemini call threw (attempt {Attempt})", attempt);
                    if (attempt < MaxAttempts)
                    {
                        await Task.Delay(TimeSpan.FromMilliseconds(600 * attempt), ct);
                        continue;
                    }
                    return (false, "", "Could not reach the AI service.");
                }
            }
            return (false, "", $"AI service is busy{(lastReason != null ? ": " + lastReason : ".")}");
        }

        // Pulls error.message out of a failed reply, so the real reason is visible.
        private static string? ReadError(string json)
        {
            try
            {
                using var doc = JsonDocument.Parse(json);
                if (doc.RootElement.TryGetProperty("error", out var error) &&
                    error.TryGetProperty("message", out var message))
                {
                    var text = message.GetString();
                    if (!string.IsNullOrWhiteSpace(text))
                        return text.Length > 300 ? text[..300] : text;
                }
            }
            catch { }
            return null;
        }
    }
}
