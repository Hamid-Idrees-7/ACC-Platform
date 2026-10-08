using System.ComponentModel.DataAnnotations;

namespace Backend.Models.DTOs
{
    // One earlier turn sent back by the browser so the assistant remembers the conversation.
    public class AiChatTurnDto
    {
        // "user" or "model" (anything else is treated as "user")
        public string Role { get; set; } = "user";

        [MaxLength(4000)]
        public string Text { get; set; } = string.Empty;
    }

    // The public website chat request.
    public class AiChatRequestDto
    {
        [Required]
        [MaxLength(1000)]
        public string Message { get; set; } = string.Empty;

        public List<AiChatTurnDto>? History { get; set; }
    }
}
