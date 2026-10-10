using System.ComponentModel.DataAnnotations;

namespace Backend.Models.Entities
{
    // One saved ERP assistant conversation, owned by a user. The messages are kept as a JSON
    // array ([{role,text}, ...]) so the whole chat is one row, easy to load, save and delete.
    public class AiConversation
    {
        public int AiConversationID { get; set; }

        public int UserID { get; set; }

        [MaxLength(120)]
        public string Title { get; set; } = "New chat";

        // JSON array of { role, text }. No length cap (nvarchar(max)).
        public string MessagesJson { get; set; } = "[]";

        public DateTime CreatedAt { get; set; } = AppTime.Now;
        public DateTime UpdatedAt { get; set; } = AppTime.Now;
    }
}
