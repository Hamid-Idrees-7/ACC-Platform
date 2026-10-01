using System.Net;
using System.Net.Mail;
using System.Net.Mime;
using Microsoft.Extensions.Options;

namespace Backend.Email
{
    // Sends mail through an SMTP server (Gmail by default) with STARTTLS on port 587.
    public class SmtpEmailSender : IEmailSender
    {
        private readonly EmailOptions _options;

        public SmtpEmailSender(IOptions<EmailOptions> options)
        {
            _options = options.Value;
        }

        public bool IsConfigured => _options.IsConfigured;

        public async Task SendAsync(string to, string subject, string html, string text, CancellationToken ct = default)
        {
            if (!IsConfigured)
                throw new InvalidOperationException("Email is not set up (Email:Username and Email:Password).");

            var from = string.IsNullOrWhiteSpace(_options.FromAddress) ? _options.Username : _options.FromAddress;
            using var message = new MailMessage
            {
                From = new MailAddress(from, _options.FromName),
                Subject = subject,
                Body = text,
                IsBodyHtml = false
            };
            message.To.Add(to);
            // Plain text first, HTML second: mail apps show the last one they can.
            message.AlternateViews.Add(AlternateView.CreateAlternateViewFromString(html, null, MediaTypeNames.Text.Html));

            using var client = new SmtpClient(_options.Host, _options.Port)
            {
                EnableSsl = true,
                DeliveryMethod = SmtpDeliveryMethod.Network,
                UseDefaultCredentials = false,
                Credentials = new NetworkCredential(_options.Username, _options.Password),
                Timeout = 20000
            };
            await client.SendMailAsync(message, ct);
        }
    }
}
