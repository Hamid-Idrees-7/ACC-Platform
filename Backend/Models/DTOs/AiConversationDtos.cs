using System.ComponentModel.DataAnnotations;

namespace Backend.Models.DTOs
{
    // A row in the history list.
    public class AiConversationSummaryDto
    {
        public int Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public DateTime UpdatedAt { get; set; }
    }

    // One full conversation, with its messages.
    public class AiConversationDetailDto
    {
        public int Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public List<AiChatTurnDto> Messages { get; set; } = new();
    }

    // Create or update a conversation.
    public class SaveAiConversationDto
    {
        [MaxLength(120)]
        public string Title { get; set; } = "New chat";

        public List<AiChatTurnDto> Messages { get; set; } = new();
    }
}
