namespace Backend.Models.DTOs
{
    // What we send back after a successful login/register
    public class AuthResponseDto
    {
        public string Token { get; set; } = string.Empty;
        public int UserID { get; set; }
        public string Username { get; set; } = string.Empty;
        public string FullName { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
    }
}