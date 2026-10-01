namespace Backend.Models.DTOs
{
    // Sent to create an invoice, or to edit one when the route has an InvoiceID.
    // The server works out the invoice number, each line's Amount, the subtotal and the total;
    // the client sends only the raw inputs.
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
