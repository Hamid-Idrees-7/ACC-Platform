using System.ComponentModel.DataAnnotations;

namespace Backend.Models.DTOs
{
    public class UpdateProjectStatusDto
    {
        [Required]
        [MaxLength(20)]
        public string Status { get; set; } = string.Empty;
    }
}
