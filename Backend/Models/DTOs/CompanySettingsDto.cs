namespace Backend.Models.DTOs
{
    // What printed documents (invoice, payslip) need about the company.
    public class CompanyBrandDto
    {
        public string CompanyName { get; set; } = string.Empty;
        public string? Tagline { get; set; }
        public string? Logo { get; set; }
        public string? Address { get; set; }
        public string? City { get; set; }
        public string? Phone { get; set; }
        public string? Email { get; set; }
        public string? Website { get; set; }
        public string? NTN { get; set; }
        public string? STRN { get; set; }

        public string CurrencyCode { get; set; } = string.Empty;
        public string CurrencySymbol { get; set; } = string.Empty;   // Rs.
        public string CurrencyWord { get; set; } = string.Empty;     // rupees

        public string? InvoiceTerms { get; set; }
        public string? BankName { get; set; }
        public string? BankAccountTitle { get; set; }
        public string? BankAccountNumber { get; set; }
        public string? BankIBAN { get; set; }
    }

    // Settings > Company: everything, plus a few values worked out by the server.
    public class CompanySettingsDto : CompanyBrandDto
    {
        public string InvoicePrefix { get; set; } = string.Empty;
        public decimal DefaultTaxPercent { get; set; }

        // The number the next new invoice will get, eg INV-0042
        public string NextInvoiceNumber { get; set; } = string.Empty;

        // True until the admin saves the settings for the first time
        public bool IsDefault { get; set; }
        public DateTime? UpdatedAt { get; set; }
        public string? UpdatedBy { get; set; }
    }

    // Sent by the admin to save Settings > Company.
    public class SaveCompanySettingsDto
    {
        public string? CompanyName { get; set; }
        public string? Tagline { get; set; }
        public string? Logo { get; set; }          // data URL, or null / empty to remove
        public string? Address { get; set; }
        public string? City { get; set; }
        public string? Phone { get; set; }
        public string? Email { get; set; }
        public string? Website { get; set; }
        public string? NTN { get; set; }
        public string? STRN { get; set; }

        public string? CurrencyCode { get; set; }

        public string? InvoicePrefix { get; set; }
        public decimal DefaultTaxPercent { get; set; }
        public string? InvoiceTerms { get; set; }

        public string? BankName { get; set; }
        public string? BankAccountTitle { get; set; }
        public string? BankAccountNumber { get; set; }
        public string? BankIBAN { get; set; }
    }
}
