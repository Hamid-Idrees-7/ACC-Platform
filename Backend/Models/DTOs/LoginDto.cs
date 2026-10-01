namespace Backend.Models.DTOs
{
    public class LoginDto
    {
        public string Username { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;

        // "Keep me signed in": 30 days on this device instead of until the browser closes.
        public bool KeepSignedIn { get; set; }
    }
}