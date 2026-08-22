namespace Backend.Models.DTOs
{
    public class ProjectPhaseDto
    {
        public int PhaseID { get; set; }
        public string Name { get; set; } = string.Empty;
        public int OrderNo { get; set; }
        public string Status { get; set; } = string.Empty;
        public int Progress { get; set; }
    }
}
