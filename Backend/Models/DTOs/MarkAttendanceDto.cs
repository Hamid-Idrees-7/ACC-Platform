namespace Backend.Models.DTOs
{
    // Save request: one project's attendance for a single date. Only the rows the user
    // marked are sent; the service upserts each (insert new, or update the existing day).
    public class MarkAttendanceDto
    {
        public DateTime Date { get; set; }
        public List<AttendanceEntryDto> Entries { get; set; } = new();
    }

    public class AttendanceEntryDto
    {
        public int AssignmentID { get; set; }
        // Present or Absent
        public string Status { get; set; } = string.Empty;
        public string? Note { get; set; }
    }
}
