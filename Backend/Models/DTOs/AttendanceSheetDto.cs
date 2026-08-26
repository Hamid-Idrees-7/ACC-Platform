namespace Backend.Models.DTOs
{
    // The full Mark Attendance sheet for one project on one date.
    public class AttendanceSheetDto
    {
        public int ProjectID { get; set; }
        public string ProjectTitle { get; set; } = string.Empty;
        public string Location { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public string SiteIncharge { get; set; } = "Not assigned";

        public DateTime Date { get; set; }
        // A cancelled project is read-only: past records are shown but no new marking.
        public bool IsReadOnly { get; set; }

        public List<AttendanceWorkerDto> MonthlyStaff { get; set; } = new();
        public List<AttendanceWorkerDto> DailyWorkers { get; set; } = new();

        // Counts for the selected date, over workers who are on site that day.
        public int PresentCount { get; set; }
        public int AbsentCount { get; set; }
        public int UnmarkedCount { get; set; }
    }

    // One worker row on the sheet — an assignment, its wage, and its attendance.
    public class AttendanceWorkerDto
    {
        public int AssignmentID { get; set; }
        public int EmployeeID { get; set; }
        public string EmployeeName { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public string WageType { get; set; } = string.Empty;
        public decimal WageAmount { get; set; }

        public DateTime StartDate { get; set; }
        public DateTime? EndDate { get; set; }

        // True when the selected date falls inside this assignment's period.
        // When false, the row is shown but marking is disabled (period ended / not started)
        public bool OnSiteThisDate { get; set; }

        // Attendance for the selected date: Present, Absent or null (not marked).
        public string? Status { get; set; }
        public string? Note { get; set; }

        // Day-by-day history from StartDate up to the earlier of EndDate and today.
        public List<AttendanceDayDto> Timeline { get; set; } = new();
    }

    // One dot in a worker's attendance timeline.
    public class AttendanceDayDto
    {
        public DateTime Date { get; set; }
        // present, Absent or null (not marked)
        public string? Status { get; set; }
    }
}
