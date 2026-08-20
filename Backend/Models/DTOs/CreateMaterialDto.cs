using System.ComponentModel.DataAnnotations;

namespace Backend.Models.DTOs
{
    public class CreateMaterialDto
    {
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

        // Optional opening balance, used only when creating a material.
        // On edit these are ignored.
        public decimal? InitialStock { get; set; }
        public decimal? InitialRate { get; set; }
    }
}
