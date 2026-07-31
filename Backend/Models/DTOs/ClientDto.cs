namespace Backend.Models.DTOs
{
    // Used when creating or updating a client (data coming IN from the user).
    // Note: no ClientID or CreatedAt here - those are handled by the system.
    public class ClientDto
    {
        public string FullName { get; set; } = string.Empty;
        public string? Email { get; set; }
        public string Phone { get; set; } = string.Empty;
        public string? SecondaryPhone { get; set; }
        public string? CNIC { get; set; }
        public string? Address { get; set; }
        public string? City { get; set; }
        public string ClientType { get; set; } = "External";
        public string Status { get; set; } = "Active";
    }
}