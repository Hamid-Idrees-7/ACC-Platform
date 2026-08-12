namespace Backend.Models.DTOs
{
    // Used when sending user data OUT to the frontend (never includes the password)
    public class UserDto
    {
        public int UserID { get; set; }
        public string Username { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string FullName { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public string? Phone { get; set; }
        public string? SecondaryPhone { get; set; }
        public string? ProfilePicture { get; set; }
        public int? EmployeeID { get; set; }
        public bool IsActive { get; set; }
        public DateTime? LastLogin { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}