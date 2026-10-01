using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Backend.Models.Entities
{
    // The company's own details (Settings > Company, Admin only). There is only ever one
    // row (ID 1). Until the admin saves for the first time, the defaults below are used.
    // Invoices, payslips, the currency symbol and the weekly off days all read from here.
    public class CompanySetting
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.None)]
        public int CompanySettingID { get; set; } = CompanyOptions.RowId;

        // Company profile
        [Required]
        [MaxLength(100)]
        public string CompanyName { get; set; } = CompanyOptions.DefaultName;

        [MaxLength(100)]
        public string? Tagline { get; set; }

        // Logo as a data URL (PNG / JPEG / WebP, resized in the browser before upload)
        public string? Logo { get; set; }

        [MaxLength(200)]
        public string? Address { get; set; }

        [MaxLength(60)]
        public string? City { get; set; }

        [MaxLength(30)]
        public string? Phone { get; set; }

        [MaxLength(100)]
        public string? Email { get; set; }

        [MaxLength(100)]
        public string? Website { get; set; }

        // Tax registration: National Tax Number and Sales Tax Registration Number
        [MaxLength(30)]
        public string? NTN { get; set; }

        [MaxLength(30)]
        public string? STRN { get; set; }

        // Currency (symbol only, amounts are never converted)
        [Required]
        [MaxLength(3)]
        public string CurrencyCode { get; set; } = CompanyOptions.DefaultCurrency;

        // Invoices
        [Required]
        [MaxLength(10)]
        public string InvoicePrefix { get; set; } = CompanyOptions.DefaultInvoicePrefix;

        // Suggested tax on a new invoice, as a percentage of the subtotal
        [Column(TypeName = "decimal(5,2)")]
        public decimal DefaultTaxPercent { get; set; }

        // Printed at the bottom of every invoice (payment terms, thank-you note)
        [MaxLength(500)]
        public string? InvoiceTerms { get; set; }

        // Bank details printed on invoices
        [MaxLength(100)]
        public string? BankName { get; set; }

        [MaxLength(100)]
        public string? BankAccountTitle { get; set; }

        [MaxLength(40)]
        public string? BankAccountNumber { get; set; }

        [MaxLength(40)]
        public string? BankIBAN { get; set; }

        // Calendar (Settings > Calendar): the days of the week the sites are closed,
        // comma separated in week order, eg "Sunday" or "Friday,Sunday". Empty = none.
        [MaxLength(80)]
        public string WeeklyOffDays { get; set; } = CompanyOptions.DefaultWeeklyOff;

        public DateTime UpdatedAt { get; set; } = DateTime.Now;

        [MaxLength(100)]
        public string? UpdatedBy { get; set; }
    }

    // Defaults and allowed values, shared by the entity, validation and the API.
    public static class CompanyOptions
    {
        public const int RowId = 1;
        public const string DefaultName = "Anonymous Construction & Co.";
        public const string DefaultCurrency = "PKR";
        public const string DefaultInvoicePrefix = "INV";
        public const string DefaultWeeklyOff = "Sunday";

        // Largest logo accepted (characters of the data URL, about 450 KB of image)
        public const int MaxLogoLength = 600_000;

        // Week order used to store and show the weekly off days
        public static readonly string[] WeekDays =
            { "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday" };

        public static List<string> SplitDays(string? stored) =>
            (stored ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Where(d => WeekDays.Contains(d))
                .ToList();

        // Currency code to the symbol shown before amounts and the word used in "amount in words"
        public static readonly Dictionary<string, (string Symbol, string Word)> Currencies = new()
        {
            ["PKR"] = ("Rs.", "rupees"),
            ["USD"] = ("$", "dollars"),
            ["GBP"] = ("£", "pounds"),
            ["EUR"] = ("€", "euros"),
            ["AED"] = ("AED", "dirhams"),
            ["SAR"] = ("SAR", "riyals"),
        };

        public static (string Symbol, string Word) Currency(string? code) =>
            code != null && Currencies.TryGetValue(code, out var c) ? c : Currencies[DefaultCurrency];
    }
}
