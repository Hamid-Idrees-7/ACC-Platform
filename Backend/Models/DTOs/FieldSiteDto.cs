namespace Backend.Models.DTOs
{
    // The Site Engineers my Site view — who they are + the projects they are
    // assigned to, each with today's attendance snapshot. Scoped server-side to the
    // logged-in user's linked employee, so an engineer only ever sees their own sites.
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
