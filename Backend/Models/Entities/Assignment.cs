using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Backend.Models.Entities
{
    public class Assignment
    {
        [Key]
        public int AssignmentID { get; set; }

        [Required]
        public int EmployeeID { get; set; }

        [Required]
        public int ProjectID { get; set; }

        // Snapshot of the employee's role/designation for this assignment
        [Required]
        [MaxLength(50)]
        public string Role { get; set; } = string.Empty;

        // Daily, Monthly, Contract
        [Required]
        [MaxLength(20)]
        public string WageType { get; set; } = "Daily";

        [Column(TypeName = "decimal(18,2)")]
        public decimal WageAmount { get; set; }

        public DateTime StartDate { get; set; }
        public DateTime? EndDate { get; set; }

        // active or completed
        [Required]
        [MaxLength(20)]
        public string Status { get; set; } = "Active";

        [MaxLength(255)]
        public string? Notes { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.Now;
        public DateTime UpdatedAt { get; set; } = DateTime.Now;
    }
}
