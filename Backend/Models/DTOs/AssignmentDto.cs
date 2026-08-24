namespace Backend.Models.DTOs
{
    public class AssignmentDto
    {
        public int AssignmentID { get; set; }
        public int EmployeeID { get; set; }
        public string EmployeeName { get; set; } = string.Empty;
        public int ProjectID { get; set; }
        public string ProjectTitle { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public string WageType { get; set; } = string.Empty;
        public decimal WageAmount { get; set; }
        public DateTime StartDate { get; set; }
        public DateTime? EndDate { get; set; }
        public string Status { get; set; } = string.Empty;
        public string? Notes { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}
