namespace Backend.Models.DTOs
{
    public class PermissionDto
    {
        public string Module { get; set; } = string.Empty;
        public string Action { get; set; } = string.Empty;
        public bool IsAllowed { get; set; }
        public bool RequiresApproval { get; set; }
    }
}