using System.ComponentModel.DataAnnotations;

namespace Backend.Models.Entities
{
    // Represents a system user who can log in (maps to the "Users" table)
    public class User
    {
        // Primary key - unique ID for each user
        [Key]
        public int UserID { get; set; }

        // Username for login - required, unique, max 50 characters
        [Required]
        [MaxLength(50)]
        public string Username { get; set; } = string.Empty;

        // The HASHED password (never the real password) - required
        [Required]
        [MaxLength(255)]
        public string PasswordHash { get; set; } = string.Empty;

        // Email - required, max 100 characters
        [Required]
        [MaxLength(100)]
        public string Email { get; set; } = string.Empty;

        // Full name - required
        [Required]
        [MaxLength(100)]
        public string FullName { get; set; } = string.Empty;

        // Role name (e.g. "Admin", "Manager", "HR") - dynamic, set by admin
        [Required]
        [MaxLength(50)]
        public string Role { get; set; } = string.Empty;

        // Phone number - optional
        [MaxLength(20)]
        public string? Phone { get; set; }

        // Whether the account is active - defaults to true
        public bool IsActive { get; set; } = true;

        // When the user last logged in - optional
        public DateTime? LastLogin { get; set; }

        // When this user was created
        public DateTime CreatedAt { get; set; } = DateTime.Now;

        // When this user was last updated
        public DateTime UpdatedAt { get; set; } = DateTime.Now;
    }
}