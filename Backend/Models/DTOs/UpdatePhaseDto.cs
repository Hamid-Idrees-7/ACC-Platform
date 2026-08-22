using System.ComponentModel.DataAnnotations;

namespace Backend.Models.DTOs
{
    public class UpdatePhaseDto
    {
        [Required]
        [MaxLength(20)]
        public string Status { get; set; } = "Pending";

        public int Progress { get; set; }
    }
}
