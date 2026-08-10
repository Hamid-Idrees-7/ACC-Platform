namespace Backend.Models.DTOs
{
    public class UpdatePictureDto
    {
        // Base64 image string (or null to remove the picture)
        public string? ProfilePicture { get; set; }
    }
}