namespace Backend.Models.DTOs
{
    public class ProjectDetailDto
    {
        public int ProjectID { get; set; }
        public string Title { get; set; } = string.Empty;
        public int ClientID { get; set; }
        public string ClientName { get; set; } = string.Empty;
        public string? ClientPhone { get; set; }
        public string ProjectType { get; set; } = string.Empty;
        public string AreaSize { get; set; } = string.Empty;
        public string Location { get; set; } = string.Empty;
        public string? Description { get; set; }
        public DateTime? StartDate { get; set; }
        public DateTime? ExpectedEndDate { get; set; }
        public decimal Budget { get; set; }
        public string Status { get; set; } = string.Empty;
        public int OverallProgress { get; set; }

        public ProjectFinancialsDto Financials { get; set; } = new();
        public List<ProjectPhaseDto> Phases { get; set; } = new();
        public List<AssignmentDto> Team { get; set; } = new();
        public List<PhaseMaterialsDto> MaterialsByPhase { get; set; } = new();

        public DateTime CreatedAt { get; set; }
    }
}
