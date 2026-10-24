namespace Backend.Email
{
    // "Email" section of the settings. Secrets (Password, ApiKey) go in User Secrets or the host's
    // environment variables, never in appsettings.json.
    //
    // Provider picks how mail leaves the app:
    //   smtp   - a mail server on port 587 (Gmail by default). The password is a Gmail app password
    //            (Google account > Security > App passwords), not the normal Gmail password. Works
    //            locally, but many hosts block SMTP ports, so it is not a safe choice for a live site.
    //   resend - the Resend HTTP API over HTTPS, which no host blocks. Needs ApiKey and a FromAddress
    //            on a domain verified with Resend.
    public class EmailOptions
    {
        public string Provider { get; set; } = "smtp";

        // SMTP
        public string Host { get; set; } = "smtp.gmail.com";
        public int Port { get; set; } = 587;
        public string Username { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;

        // Resend
        public string ApiKey { get; set; } = string.Empty;

        // Sender shown to the reader. For SMTP the address defaults to Username; Resend always
        // needs it spelled out, on a domain it has verified.
        public string FromAddress { get; set; } = string.Empty;
        public string FromName { get; set; } = "ACC Platform";

        public bool UsesResend => string.Equals(Provider?.Trim(), "resend", StringComparison.OrdinalIgnoreCase);

        public bool IsConfigured => UsesResend
            ? !string.IsNullOrWhiteSpace(ApiKey) && !string.IsNullOrWhiteSpace(FromAddress)
            : !string.IsNullOrWhiteSpace(Username) && !string.IsNullOrWhiteSpace(Password);
    }
}
