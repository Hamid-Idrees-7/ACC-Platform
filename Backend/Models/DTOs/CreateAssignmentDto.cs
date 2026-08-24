using System.ComponentModel.DataAnnotations;

namespace Backend.Models.DTOs
{
    public class CreateAssignmentDto
    {
        [Required]
        public int EmployeeID { get; set; }

        [Required]
        public int ProjectID { get; set; }

        [Required]
        [MaxLength(50)]
        public string Role { get; set; } = string.Empty;

        [Required]
        [MaxLength(20)]
        public string WageType { get; set; } = "Daily";

        public decimal WageAmount { get; set; }

        public DateTime StartDate { get; set; }
        public DateTime? EndDate { get; set; }

        [Required]
        [MaxLength(20)]
        public string Status { get; set; } = "Active";

        [MaxLength(255)]
        public string? Notes { get; set; }
    }
}
