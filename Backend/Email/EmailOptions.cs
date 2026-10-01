namespace Backend.Email
{
    // "Email" section of the settings. Username and Password go in User Secrets, never in
    // appsettings.json. For Gmail the password is an app password (Google account >
    // Security > App passwords), not the normal Gmail password.
    public class EmailOptions
    {
        public string Host { get; set; } = "smtp.gmail.com";
        public int Port { get; set; } = 587;
        public string Username { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;

        // Sender shown to the reader. The address defaults to Username.
        public string FromAddress { get; set; } = string.Empty;
        public string FromName { get; set; } = "ACC Platform";

        public bool IsConfigured => !string.IsNullOrWhiteSpace(Username) && !string.IsNullOrWhiteSpace(Password);
    }
}
