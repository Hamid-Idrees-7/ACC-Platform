namespace Backend.Models.DTOs
{
    public class ProjectDto
    {
        public int ProjectID { get; set; }
        public string Title { get; set; } = string.Empty;
        public int ClientID { get; set; }
        public string ClientName { get; set; } = string.Empty;
        public string ProjectType { get; set; } = string.Empty;
        public string AreaSize { get; set; } = string.Empty;
        public string Location { get; set; } = string.Empty;
        public decimal Budget { get; set; }
        public string Status { get; set; } = string.Empty;
        public DateTime? StartDate { get; set; }
        public DateTime? ExpectedEndDate { get; set; }
        public int OverallProgress { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}
