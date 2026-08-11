using System.ComponentModel.DataAnnotations;

namespace Backend.Models.Entities
{
    // Represents an employee in the system (maps to the "Employees" table)
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

        // Designation - required, entered by admin (flexible, not hardcoded)
        [Required]
        [MaxLength(50)]
        public string Designation { get; set; } = string.Empty;

        // When the employee joined - optional
        public DateTime? JoiningDate { get; set; }

        // Status: "Active" or "Inactive" - defaults to Active
        [Required]
        [MaxLength(20)]
        public string Status { get; set; } = "Active";

        public DateTime CreatedAt { get; set; } = DateTime.Now;
        public DateTime UpdatedAt { get; set; } = DateTime.Now;
    }
}