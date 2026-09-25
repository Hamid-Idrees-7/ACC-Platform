namespace Backend.Models.DTOs
{
    // A site engineer updating one phase's completion on their own project.
    public class FieldProgressDto
    {
        public int PhaseID { get; set; }
        public int Progress { get; set; }   // 0–100
    }
}
