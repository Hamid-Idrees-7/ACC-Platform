namespace Backend.Models.DTOs
{
    // Payload for creating (or, with an InvoiceID via the controller route, editing) an invoice.
    // The invoice number, per-item Amount, subtotal and total are all computed on the server —
    // the client only sends the raw inputs.
    public class CreateInvoiceDto
    {
        public int ProjectID { get; set; }
        public DateTime IssueDate { get; set; }
        public DateTime? DueDate { get; set; }

        // Flat tax on top of the subtotal. 0 if none.
        public decimal TaxAmount { get; set; }

        public string? Notes { get; set; }

        public List<CreateInvoiceItemDto> Items { get; set; } = new();
    }

    public class CreateInvoiceItemDto
    {
        public string Description { get; set; } = string.Empty;
        public decimal Quantity { get; set; } = 1;
        public decimal Rate { get; set; }

        // Optional phase this line bills for (from the phase quick-fill).
        public int? PhaseID { get; set; }

        // Set when this line bills a recoverable project expense. The server then fixes the
        // line to quantity 1 at the expense amount, whatever the client sends.
        public int? ExpenseID { get; set; }
    }
}
