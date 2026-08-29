namespace Backend.Models.DTOs
{
    // Everything the printable invoice page needs, flattened into one object so the
    // frontend print view does no extra lookups.
    public class InvoicePrintDto
    {
        public string CompanyName { get; set; } = "Anonymous Construction & Co.";

        public int InvoiceID { get; set; }
        public string InvoiceNumber { get; set; } = string.Empty;
        public string Status { get; set; } = "Unpaid";
        public DateTime IssueDate { get; set; }
        public DateTime? DueDate { get; set; }

        // Bill-to (client)
        public string ClientName { get; set; } = string.Empty;
        public string? ClientPhone { get; set; }
        public string? ClientAddress { get; set; }

        // Project
        public string ProjectTitle { get; set; } = string.Empty;
        public string ProjectLocation { get; set; } = string.Empty;

        public List<InvoiceItemDto> Items { get; set; } = new();

        public decimal Subtotal { get; set; }
        public decimal TaxAmount { get; set; }
        public decimal Total { get; set; }
        public decimal Paid { get; set; }
        public decimal Remaining { get; set; }

        public string? Notes { get; set; }

        public List<InvoicePaymentDto> Payments { get; set; } = new();

        public DateTime GeneratedAt { get; set; } = DateTime.Now;
    }
}
