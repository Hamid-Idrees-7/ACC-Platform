using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Options;

namespace Backend.Email
{
    // Sends mail through Resend's HTTP API (https://resend.com) over HTTPS, so it keeps working on
    // hosts that block the SMTP ports. The from address must be on a domain verified with Resend.
    public class ResendEmailSender : IEmailSender
    {
        private const string SendUrl = "https://api.resend.com/emails";

        private readonly EmailOptions _options;
        private readonly IHttpClientFactory _http;

        public ResendEmailSender(IOptions<EmailOptions> options, IHttpClientFactory http)
        {
            _options = options.Value;
            _http = http;
        }

        public bool IsConfigured => _options.IsConfigured;

        public async Task SendAsync(string to, string subject, string html, string text, CancellationToken ct = default)
        {
            if (!IsConfigured)
                throw new InvalidOperationException("Email is not set up (Email:ApiKey and Email:FromAddress).");

            // A key pasted into a host's settings box often picks up a newline; it would be rejected
            // as a header value before the request is even sent.
            var key = _options.ApiKey.Replace("\r", "").Replace("\n", "").Replace("\0", "").Trim();
            var from = string.IsNullOrWhiteSpace(_options.FromName)
                ? _options.FromAddress
                : $"{_options.FromName} <{_options.FromAddress}>";

            var client = _http.CreateClient("email");
            using var request = new HttpRequestMessage(HttpMethod.Post, SendUrl)
            {
                Content = JsonContent.Create(new
                {
                    from,
                    to = new[] { to },
                    subject,
                    html,
                    text
                })
            };
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", key);

            using var response = await client.SendAsync(request, ct);
            if (!response.IsSuccessStatusCode)
            {
                // Resend answers with a short JSON message saying what was wrong, eg an unverified
                // domain or a bad key. It goes in the exception so the log names the real cause.
                var body = await response.Content.ReadAsStringAsync(ct);
                throw new InvalidOperationException($"Resend refused the message ({(int)response.StatusCode}): {Summarise(body)}");
            }
        }

        // Pulls the "message" out of Resend's error body, and falls back to the raw body.
        private static string Summarise(string body)
        {
            if (string.IsNullOrWhiteSpace(body)) return "no details";
            try
            {
                using var doc = JsonDocument.Parse(body);
                if (doc.RootElement.TryGetProperty("message", out var message))
                    return message.GetString() ?? body;
            }
            catch (JsonException)
            {
                // not JSON: the raw body is the best we have
            }
            return body.Length > 300 ? body[..300] : body;
        }
    }
}
