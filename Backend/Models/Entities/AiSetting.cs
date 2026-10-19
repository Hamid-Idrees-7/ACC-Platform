using System.ComponentModel.DataAnnotations;

namespace Backend.Models.Entities
{
    // Single-row table (Id = 1) holding the live on/off switches for the two AI assistants,
    // so an admin can turn them off for everyone without a redeploy.
    public class AiSetting
    {
        public int AiSettingID { get; set; }

        // The public website visitor chat.
        public bool PublicEnabled { get; set; } = true;

        // The in-system assistant for signed-in staff.
        public bool ErpEnabled { get; set; } = true;

        public DateTime UpdatedAt { get; set; } = AppTime.Now;

        [MaxLength(100)]
        public string? UpdatedBy { get; set; }
    }
}
