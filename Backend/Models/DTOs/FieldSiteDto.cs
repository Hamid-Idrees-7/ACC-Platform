namespace Backend.Models.DTOs
{
    // The site engineer's My Site view: who they are and the projects they are
    // assigned to, each with today's attendance. The server limits it to the
    // logged-in user's linked employee, so an engineer only sees their own sites.
    public class FieldSiteDto
    {
        public string EmployeeName { get; set; } = string.Empty;
        public string Designation { get; set; } = string.Empty;
        public bool IsFieldUser { get; set; }   // false if this login isn't linked to an employee
        public List<FieldProjectCardDto> Projects { get; set; } = new();
    }

    public class FieldProjectCardDto
    {
        public int ProjectID { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Location { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public int Progress { get; set; }
        public int WorkersCount { get; set; }
        public int TodayPresent { get; set; }
        public int TodayAbsent { get; set; }
        public int TodayUnmarked { get; set; }
    }
}
