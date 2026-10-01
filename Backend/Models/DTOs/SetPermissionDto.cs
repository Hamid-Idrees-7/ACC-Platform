using System.ComponentModel.DataAnnotations;

namespace Backend.Models.DTOs
{
    // Sent when the admin turns a permission on or off.
    public class SetPermissionDto
    {
        [Required]
        public int UserID { get; set; }

        [Required]
        [MaxLength(50)]
        public string Module { get; set; } = string.Empty;

        [Required]
        [MaxLength(30)]
        public string Action { get; set; } = string.Empty;

        public bool IsAllowed { get; set; }

        public bool RequiresApproval { get; set; }
    }
}