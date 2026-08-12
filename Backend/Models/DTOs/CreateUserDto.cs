using System.ComponentModel.DataAnnotations;

namespace Backend.Models.DTOs
{
    // Used when an admin creates or updates a user (data coming IN)
    public class CreateUserDto
    {
        [Required]
        [MaxLength(50)]
        public string Username { get; set; } = string.Empty;

        // Plain password from the admin - will be hashed before saving.
        // Optional on edit: if left empty, the existing password is kept.
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