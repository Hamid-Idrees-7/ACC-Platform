namespace Backend.Email
{
    public interface IEmailSender
    {
        bool IsConfigured { get; }

        // Throws when the mail server refuses the message.
        Task SendAsync(string to, string subject, string html, string text, CancellationToken ct = default);
    }
}
