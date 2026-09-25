namespace Backend.Models.DTOs
{
    // What a site engineer is allowed to see about their own site — NO financials
    // (budget/cost/profit stay with management). Just the site facts + progress.
    public class FieldSiteInfoDto
    {
        public int ProjectID { get; set; }
        public string Title { get; set; } = string.Empty;
        public string ClientName { get; set; } = string.Empty;
        public string Location { get; set; } = string.Empty;
        public string ProjectType { get; set; } = string.Empty;
        public string AreaSize { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public int OverallProgress { get; set; }
        public DateTime? StartDate { get; set; }
        public DateTime? ExpectedEndDate { get; set; }
        public string? Description { get; set; }
        public int TotalPhases { get; set; }
        public int CompletedPhases { get; set; }
        public int TeamSize { get; set; }
    }
}
