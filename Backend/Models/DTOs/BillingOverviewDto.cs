namespace Backend.Models.DTOs
{
    // The Billing & Invoices list page: top stats + a card per project.
    public class BillingOverviewDto
    {
        public int TotalProjects { get; set; }
        public int TotalInvoices { get; set; }
        public int PaidCount { get; set; }
        public decimal PaidAmount { get; set; }
        public int UnpaidCount { get; set; }
        public decimal UnpaidAmount { get; set; }   // outstanding on unpaid/partial invoices
        public int OverdueCount { get; set; }
        public decimal OverdueAmount { get; set; }
        public List<BillingProjectCardDto> Projects { get; set; } = new();
    }

    public class BillingProjectCardDto
    {
        public int ProjectID { get; set; }
        public string Title { get; set; } = string.Empty;
        public string ClientName { get; set; } = string.Empty;
        public string Location { get; set; } = string.Empty;
        public string ProjectType { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public decimal Budget { get; set; }
        public int InvoiceCount { get; set; }
        public int PaidCount { get; set; }
        public int OverdueCount { get; set; }
        public decimal Billed { get; set; }         // total invoiced
        public decimal Received { get; set; }
        public decimal Outstanding { get; set; }    // billed - received
    }
}
