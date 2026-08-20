using System.ComponentModel.DataAnnotations;

namespace Backend.Models.Entities
{
    public class Material
    {
        [Key]
        public int MaterialID { get; set; }

        [Required]
        [MaxLength(100)]
        public string Name { get; set; } = string.Empty;

        [Required]
        [MaxLength(50)]
        public string Category { get; set; } = string.Empty;

        [Required]
        [MaxLength(20)]
        public string Unit { get; set; } = string.Empty;

        public int LowStockThreshold { get; set; }

        [Required]
        [MaxLength(20)]
        public string Status { get; set; } = "Active";

        public DateTime CreatedAt { get; set; } = DateTime.Now;
        public DateTime UpdatedAt { get; set; } = DateTime.Now;
    }
}
