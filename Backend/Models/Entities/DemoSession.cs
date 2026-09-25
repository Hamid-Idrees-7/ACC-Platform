using System.ComponentModel.DataAnnotations;
using Microsoft.EntityFrameworkCore;

namespace Backend.Models.Entities
{
    // Registry entry for one isolated visitor database. Kept in the MAIN database and used to
    // track each demo database through its lifecycle:
    //   Preparing (being built for the ready pool) to Ready (waiting for a visitor)
    //   Claimed (being built on demand for a visitor) to Active (in use) to Ended (dropped)
    [Index(nameof(DatabaseName), IsUnique = true)]
    public class DemoSession
    {
        [Key]
        public int DemoSessionID { get; set; }

        // Physical database name, always ACC_Demo_ followed by 12 hex characters.
        [Required]
        [MaxLength(40)]
        public string DatabaseName { get; set; } = string.Empty;

        [Required]
        [MaxLength(20)]
        public string Status { get; set; } = "Preparing";

        // The role the visitor started with (admin / manager / engineer). Used for the owner's activity log only.
        [MaxLength(20)]
        public string? StartRole { get; set; }

        // All timestamps are UTC.
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? StartedAt { get; set; }
        public DateTime? ExpiresAt { get; set; }
        public DateTime? EndedAt { get; set; }

        // Set once the physical database has been dropped from the server.
        public bool IsDropped { get; set; }
    }
}
