using System.ComponentModel.DataAnnotations;

namespace Backend.Models.Entities
{
    // A company employee (Employees table).
    public class Employee
    {
        [Key]
        public int EmployeeID { get; set; }

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
        public string? Email { get; set; }

        [MaxLength(255)]
        public string? Address { get; set; }

        [MaxLength(50)]
        public string? City { get; set; }

        // Free text entered by the admin, not a fixed list
        [Required]
        [MaxLength(50)]
        public string Designation { get; set; } = string.Empty;

        public DateTime? JoiningDate { get; set; }

        // Active or Inactive
        [Required]
        [MaxLength(20)]
        public string Status { get; set; } = "Active";

        public DateTime CreatedAt { get; set; } = DateTime.Now;
        public DateTime UpdatedAt { get; set; } = DateTime.Now;
    }
}