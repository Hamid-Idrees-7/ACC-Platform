using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Backend.Models.Entities
{
    // A company holiday (Settings > Calendar): one day or a few days in a row,
    // eg "Eid ul Adha" 27 May to 29 May. Attendance shows these days as off.
    public class CompanyHoliday
    {
        [Key]
        public int HolidayID { get; set; }

        [Required]
        [MaxLength(60)]
        public string Name { get; set; } = string.Empty;

        [Column(TypeName = "date")]
        public DateTime StartDate { get; set; }

        // Same as StartDate for a one-day holiday
        [Column(TypeName = "date")]
        public DateTime EndDate { get; set; }

        public DateTime CreatedAt { get; set; } = AppTime.Now;

        [MaxLength(100)]
        public string? CreatedBy { get; set; }
    }
}
