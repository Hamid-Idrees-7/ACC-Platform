using System.ComponentModel.DataAnnotations;

namespace Backend.Models.DTOs
{
    // Sent when an admin creates or updates a user.
    public class CreateUserDto
    {
        [Required]
        [MaxLength(50)]
        public string Username { get; set; } = string.Empty;

        // Plain password from the admin, hashed before saving.
        // Optional on edit: left empty, the current password stays.
        public string? Password { get; set; }

        [Required]
        [MaxLength(100)]
        [EmailAddress]
        public string Email { get; set; } = string.Empty;

        [Required]
        [MaxLength(100)]
        public string FullName { get; set; } = string.Empty;

        [Required]
        [MaxLength(50)]
        public string Role { get; set; } = string.Empty;

        [MaxLength(15)]
        public string? Phone { get; set; }

        [MaxLength(15)]
        public string? SecondaryPhone { get; set; }

        public int? EmployeeID { get; set; }

        public bool IsActive { get; set; } = true;
    }
}