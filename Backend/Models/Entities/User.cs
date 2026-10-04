using System.ComponentModel.DataAnnotations;

namespace Backend.Models.Entities
{
    // A user who can sign in (Users table).
    public class User
    {
        [Key]
        public int UserID { get; set; }

        [Required]
        [MaxLength(50)]
        public string Username { get; set; } = string.Empty;

        // Hashed password, never the plain text
        [Required]
        [MaxLength(255)]
        public string PasswordHash { get; set; } = string.Empty;

        [Required]
        [MaxLength(100)]
        public string Email { get; set; } = string.Empty;

        [Required]
        [MaxLength(100)]
        public string FullName { get; set; } = string.Empty;

        // Role name set by the admin, eg Admin, Manager, HR
        [Required]
        [MaxLength(50)]
        public string Role { get; set; } = string.Empty;

        [MaxLength(15)]
        public string? Phone { get; set; }

        [MaxLength(15)]
        public string? SecondaryPhone { get; set; }

        [MaxLength(300)]
        public string? Bio { get; set; }

        // Profile picture as a Base64 string
        public string? ProfilePicture { get; set; }

        // Optional link to an employee record (for field staff like site engineers)
        public int? EmployeeID { get; set; }

        public bool IsActive { get; set; } = true;

        public DateTime? LastLogin { get; set; }

        public DateTime CreatedAt { get; set; } = AppTime.Now;

        public DateTime UpdatedAt { get; set; } = AppTime.Now;
    }
}