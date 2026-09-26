namespace Backend.Models.DTOs
{
    // The billing detail page for a single project: header metrics, its invoices,
    // and the phase list used to quick-fill new invoice line items.
    public class ProjectBillingDto
    {
        public int ProjectID { get; set; }
        public string Title { get; set; } = string.Empty;
        public string ClientName { get; set; } = string.Empty;
        public string? ClientPhone { get; set; }
        public string Location { get; set; } = string.Empty;
        public string ProjectType { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;

        public decimal Budget { get; set; }          // the agreed client price
        public decimal TotalInvoiced { get; set; }    // sum of invoice totals
        public decimal Received { get; set; }         // sum of payments
        public decimal Outstanding { get; set; }      // invoiced - received
        public decimal PercentInvoiced { get; set; }  // contractInvoiced / budget * 100

        // TotalInvoiced split in two: work billed against the budget, and expenses billed back
        // (reimbursements are outside the agreed price, so they don't count toward the budget).
        public decimal ContractInvoiced { get; set; }
        public decimal ReimbursementInvoiced { get; set; }

        // Recoverable expenses not billed yet — offered as quick-fill lines in the invoice form.
        public List<PendingReimbursementDto> PendingReimbursements { get; set; } = new();

        public List<InvoiceDto> Invoices { get; set; } = new();
        public List<PhaseOptionDto> Phases { get; set; } = new();
    }

    // A full invoice with its line items and payments. Money fields are computed
    // server-side (Subtotal = sum of item amounts, Total = Subtotal + Tax, etc)
    public class InvoiceDto
    {
        public int InvoiceID { get; set; }
        public string InvoiceNumber { get; set; } = string.Empty;
        public DateTime IssueDate { get; set; }
        public DateTime? DueDate { get; set; }

        public decimal Subtotal { get; set; }
        public decimal TaxAmount { get; set; }
        public decimal Total { get; set; }
        public decimal Paid { get; set; }
        public decimal Due { get; set; }
        public string Status { get; set; } = "Unpaid";  // Unpaid / Partial / Paid / Overdue

        public string? Notes { get; set; }

        public List<InvoiceItemDto> Items { get; set; } = new();
        public List<InvoicePaymentDto> Payments { get; set; } = new();
    }

    public class InvoiceItemDto
    {
        public int ItemID { get; set; }
        public string Description { get; set; } = string.Empty;
        public decimal Quantity { get; set; }
        public decimal Rate { get; set; }
        public decimal Amount { get; set; }
        public int? PhaseID { get; set; }
        public int? ExpenseID { get; set; }
    }

    public class InvoicePaymentDto
    {
        public int PaymentID { get; set; }
        public decimal Amount { get; set; }
        public DateTime PaymentDate { get; set; }
        public string Method { get; set; } = "Cash";
        public string? Reference { get; set; }
    }

    // A project phase offered as a quick-fill option when building an invoice.
    public class PhaseOptionDto
    {
        public int PhaseID { get; set; }
        public string Name { get; set; } = string.Empty;
    }
}
