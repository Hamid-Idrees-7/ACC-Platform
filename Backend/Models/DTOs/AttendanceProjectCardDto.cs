namespace Backend.Models.DTOs
{
    // One card on the Attendance list page. Projects are grouped by Status on the client.
    public class AttendanceProjectCardDto
    {
        public int ProjectID { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Location { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public string SiteIncharge { get; set; } = "Not assigned";
        public int WorkersCount { get; set; }
    }
}
