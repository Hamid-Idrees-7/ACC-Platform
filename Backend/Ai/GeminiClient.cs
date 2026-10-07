using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;

namespace Backend.Ai
{
    // Talks to Google Gemini over its REST API. We call the raw endpoint ourselves (no SDK),
    // so the data flow stays visible: build a request, post it, read the reply.
    public class GeminiClient : IAiClient
    {
        private const string BaseUrl = "https://generativelanguage.googleapis.com/v1beta/models";

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

        public async Task<AiReply> SendAsync(string systemPrompt, string userMessage, CancellationToken ct = default)
        {
            if (string.IsNullOrWhiteSpace(_options.ApiKey))
                return new AiReply(false, "", "AI key is not set. Add Ai:ApiKey to User Secrets.");

            // Gemini's request shape: a system instruction, then the conversation turns.
            var body = new
            {
                systemInstruction = new { parts = new[] { new { text = systemPrompt } } },
                contents = new[]
                {
                    new { role = "user", parts = new[] { new { text = userMessage } } }
                }
            };

            var url = $"{BaseUrl}/{_options.Model}:generateContent";

            try
            {
                using var request = new HttpRequestMessage(HttpMethod.Post, url);
                request.Headers.Add("x-goog-api-key", _options.ApiKey);
                request.Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");

                var http = _httpFactory.CreateClient("ai");
                using var response = await http.SendAsync(request, ct);
                var json = await response.Content.ReadAsStringAsync(ct);

                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning("Gemini call failed: {Status} {Body}", (int)response.StatusCode, json);
                    var reason = ReadError(json);
                    return new AiReply(false, "", $"AI service returned {(int)response.StatusCode}{(reason != null ? ": " + reason : ".")}");
                }

                var text = ReadText(json);
                if (text == null)
                {
                    _logger.LogWarning("Gemini reply had no text: {Body}", json);
                    return new AiReply(false, "", "AI service returned no text.");
                }

                return new AiReply(true, text);
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Gemini call threw");
                return new AiReply(false, "", "Could not reach the AI service.");
            }
        }

        // Pulls candidates[0].content.parts[*].text out of the reply.
        private static string? ReadText(string json)
        {
            using var doc = JsonDocument.Parse(json);
            if (!doc.RootElement.TryGetProperty("candidates", out var candidates) || candidates.GetArrayLength() == 0)
                return null;

            if (!candidates[0].TryGetProperty("content", out var content) ||
                !content.TryGetProperty("parts", out var parts))
                return null;

            var sb = new StringBuilder();
            foreach (var part in parts.EnumerateArray())
                if (part.TryGetProperty("text", out var t))
                    sb.Append(t.GetString());

            var text = sb.ToString().Trim();
            return text.Length == 0 ? null : text;
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
