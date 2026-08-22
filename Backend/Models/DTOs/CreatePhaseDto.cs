using System.ComponentModel.DataAnnotations;

namespace Backend.Models.DTOs
{
    public class CreatePhaseDto
    {
        [Required]
        [MaxLength(100)]
        public string Name { get; set; } = string.Empty;
    }
}
