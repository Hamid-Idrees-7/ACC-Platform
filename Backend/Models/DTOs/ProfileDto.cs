namespace Backend.Models.DTOs
{
    public class ProfileDto
    {
        public int UserID { get; set; }
        public string Username { get; set; } = string.Empty;
        public string FullName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public string? Phone { get; set; }
        public string? SecondaryPhone { get; set; }
        public string? Bio { get; set; }
        public string? ProfilePicture { get; set; }
    }
}