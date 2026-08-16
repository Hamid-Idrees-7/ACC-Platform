using System.ComponentModel.DataAnnotations;

namespace Backend.Models.Entities
{
    // Represents one permission: a user's access to a specific action within a module
    public class UserPermission
    {
        [Key]
        public int PermissionID { get; set; }

        // Which user this permission belongs to
        [Required]
        public int UserID { get; set; }

        // Module name, eg Clients
        [Required]
        [MaxLength(50)]
        public string Module { get; set; } = string.Empty;

        // Action name, e.g. "View", "Add", "Edit", "Delete"
        [Required]
        [MaxLength(30)]
        public string Action { get; set; } = string.Empty;

        // Whether this action is allowed
        public bool IsAllowed { get; set; } = false;

        // Whether this action needs admin approval before taking effect (e.g. Delete)
        public bool RequiresApproval { get; set; } = false;

        public DateTime UpdatedAt { get; set; } = DateTime.Now;
    }
}