using System.ComponentModel.DataAnnotations;

namespace Backend.Models.DTOs
{
    public class RestockDto
    {
        public decimal Quantity { get; set; }
        public decimal Rate { get; set; }

        [MaxLength(255)]
        public string? Note { get; set; }
    }
}
