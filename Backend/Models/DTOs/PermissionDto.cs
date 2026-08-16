namespace Backend.Models.DTOs
{
    // Represents one permission sent OUT to the frontend
    public class PermissionDto
    {
        public string Module { get; set; } = string.Empty;
        public string Action { get; set; } = string.Empty;
        public bool IsAllowed { get; set; }
        public bool RequiresApproval { get; set; }
    }
}