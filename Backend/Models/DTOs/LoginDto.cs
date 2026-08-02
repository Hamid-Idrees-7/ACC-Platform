namespace Backend.Models.DTOs
{
    // Data needed to log in
    public class LoginDto
    {
        public string Username { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
    }
}