namespace Backend.Models.DTOs
{
    // The admin on/off switches for the AI assistants.
    public class AiSettingsDto
    {
        public bool PublicEnabled { get; set; }
        public bool ErpEnabled { get; set; }
    }
}
