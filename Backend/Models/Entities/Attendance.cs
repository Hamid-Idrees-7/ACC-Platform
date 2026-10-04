using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Backend.Models.Entities
{
    // One attendance record per assignment per day. It is tied to the assignment,
    // not the employee, because one person can hold several assignments (different
    // projects, dates or wage rates) and each one is tracked on its own.
    public class Attendance
    {
        [Key]
        public int AttendanceID { get; set; }

        [Required]
        public int AssignmentID { get; set; }
        public Assignment? Assignment { get; set; }

        // The day this record is for. The time part is ignored: one record per calendar day.
        public DateTime Date { get; set; }

        // Present or Absent
        [Required]
        [MaxLength(20)]
        public string Status { get; set; } = string.Empty;

        [MaxLength(255)]
        public string? Note { get; set; }

        public DateTime CreatedAt { get; set; } = AppTime.Now;
        public DateTime UpdatedAt { get; set; } = AppTime.Now;
    }
}
