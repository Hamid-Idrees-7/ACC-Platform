namespace Backend.Models.DTOs
{
    // An action the assistant has prepared for the user to confirm. The assistant never runs it;
    // the frontend shows a confirm card and, on confirm, calls the normal module endpoint
    // (Method + Url + Payload), which enforces permission and validation on its own.
    public class AiProposedAction
    {
        public string Kind { get; set; } = string.Empty;      // add_client, edit_client, delete_client, approve_request, reject_request
        public string Title { get; set; } = string.Empty;     // eg "Add client"
        public string Summary { get; set; } = string.Empty;   // one line under the title
        public string Method { get; set; } = "POST";          // POST, PUT, DELETE
        public string Url { get; set; } = string.Empty;       // eg /clients, /clients/5, /approvals/3/resolve
        public object? Payload { get; set; }                   // body to send, or null (eg delete)
        public List<AiActionField> Fields { get; set; } = new();
        public string ConfirmLabel { get; set; } = "Confirm";
        public bool Danger { get; set; }                       // delete / reject -> red confirm
        public string? Note { get; set; }                      // eg "This cannot be undone."
    }

    // One row shown on the confirm card. For add/approve use Value; for edit use From and To.
    public class AiActionField
    {
        public string Label { get; set; } = string.Empty;
        public string? Value { get; set; }
        public string? From { get; set; }
        public string? To { get; set; }
        public bool Changed { get; set; }
    }
}
