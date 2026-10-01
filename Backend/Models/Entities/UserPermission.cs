using System.ComponentModel.DataAnnotations;

namespace Backend.Models.Entities
{
    // One permission: a user's access to one action in a module.
    public class UserPermission
    {
        [Key]
        public int PermissionID { get; set; }

        [Required]
        public int UserID { get; set; }

        // Module name, eg Clients
        [Required]
        [MaxLength(50)]
        public string Module { get; set; } = string.Empty;

        // Action name, eg View, Add, Edit, Delete
        [Required]
        [MaxLength(30)]
        public string Action { get; set; } = string.Empty;

        public bool IsAllowed { get; set; } = false;

        // The action needs admin approval before it takes effect (eg Delete)
        public bool RequiresApproval { get; set; } = false;

        public DateTime UpdatedAt { get; set; } = DateTime.Now;
    }
}