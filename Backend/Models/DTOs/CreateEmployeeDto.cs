using System.ComponentModel.DataAnnotations;

namespace Backend.Models.DTOs
{
    // Used when creating or updating an employee (data coming in)
    public class CreateEmployeeDto
    {
        [Required]
        [MaxLength(50)]
        public string FullName { get; set; } = string.Empty;

        [Required]
        [MaxLength(15)]
        public string Phone { get; set; } = string.Empty;

        [MaxLength(15)]
        public string? SecondaryPhone { get; set; }

        [MaxLength(15)]
        public string? CNIC { get; set; }

        [MaxLength(100)]
        [EmailAddress]
        public string? Email { get; set; }

        [MaxLength(255)]
        public string? Address { get; set; }

        [MaxLength(50)]
        public string? City { get; set; }

        [Required]
        [MaxLength(50)]
        public string Designation { get; set; } = string.Empty;

        public DateTime? JoiningDate { get; set; }

        [Required]
        [MaxLength(20)]
        public string Status { get; set; } = "Active";
    }
}