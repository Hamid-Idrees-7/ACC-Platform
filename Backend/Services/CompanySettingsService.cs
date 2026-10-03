using System.Globalization;
using System.Text.RegularExpressions;
using Backend.Models.DTOs;
using Backend.Models.Entities;
using Backend.Repositories;

namespace Backend.Services
{
    // Settings > Company: the company profile, currency, invoice defaults and operations
    // defaults. One row for the whole company, editable by the Admin only.
    public class CompanySettingsService : ICompanySettingsService
    {
        private static readonly string[] LogoPrefixes =
        {
            "data:image/png;base64,", "data:image/jpeg;base64,", "data:image/webp;base64,"
        };

        private readonly ICompanySettingsRepository _repository;
        private readonly IBillingRepository _billingRepository;

        public CompanySettingsService(ICompanySettingsRepository repository, IBillingRepository billingRepository)
        {
            _repository = repository;
            _billingRepository = billingRepository;
        }

        public async Task<CompanySettingsDto> GetAsync()
        {
            var saved = await _repository.GetAsync();
            var settings = saved ?? new CompanySetting();
            var dto = ToDto(settings);
            // A row made only by the invoice counter or the calendar is still "not set up".
            dto.IsDefault = saved == null || saved.UpdatedBy == null;
            dto.UpdatedAt = saved?.UpdatedAt;
            dto.NextInvoiceNumber = await NextNumberAsync(settings);
            return dto;
        }

        public async Task<CompanyBrandDto> GetBrandAsync()
        {
            var settings = await _repository.GetAsync() ?? new CompanySetting();
            var dto = new CompanyBrandDto();
            FillBrand(dto, settings);
            return dto;
        }

        // Takes the next number for a new invoice. One at a time per database, so two invoices
        // created together never get the same number.
        public async Task<string> NewInvoiceNumberAsync()
        {
            using var _ = await Locks.ForInvoiceNumberAsync(_repository.DatabaseName);
            var settings = await _repository.GetAsync() ?? new CompanySetting();
            var seq = await _repository.ReserveInvoiceSeqAsync(await _billingRepository.MaxInvoiceSeqAsync());
            return $"{settings.InvoicePrefix}-{seq:0000}";
        }

        public async Task<string> FormatMoneyAsync(decimal amount)
        {
            var settings = await _repository.GetAsync();
            var (symbol, _) = CompanyOptions.Currency(settings?.CurrencyCode);
            var number = amount.ToString("#,0.##", CultureInfo.InvariantCulture);
            // Word-like symbols get a space ("Rs. 500", "AED 500"), signs do not ("$500").
            return char.IsLetter(symbol[0]) ? $"{symbol} {number}" : $"{symbol}{number}";
        }

        public async Task<(CompanySettingsDto? Saved, string? Error, string? Field)> SaveAsync(SaveCompanySettingsDto dto, string? updatedBy)
        {
            var current = await _repository.GetAsync() ?? new CompanySetting();

            // Company profile
            var name = Clean(dto.CompanyName);
            if (name == null || name.Length < 2) return Fail("Enter the company name.", "companyName");
            if (name.Length > 100) return Fail("The company name can be at most 100 characters.", "companyName");
            if (!Regex.IsMatch(name, @"\p{L}")) return Fail("The company name must contain letters.", "companyName");

            var tagline = Clean(dto.Tagline);
            if (tagline != null && tagline.Length > 100) return Fail("The tagline can be at most 100 characters.", "tagline");

            var address = Clean(dto.Address);
            if (address != null && address.Length > 200) return Fail("The address can be at most 200 characters.", "address");

            var city = Clean(dto.City);
            if (city != null && (city.Length > 60 || !Regex.IsMatch(city, @"^[\p{L}][\p{L}\s.'-]*$")))
                return Fail("Enter a valid city name (letters only).", "city");

            var phone = Clean(dto.Phone);
            if (phone != null)
            {
                var digits = Regex.Replace(phone, @"\D", "").Length;
                if (!Regex.IsMatch(phone, @"^\+?[0-9\s()-]+$") || digits < 7 || digits > 15 || phone.Length > 30)
                    return Fail("Enter a valid phone number, eg 051-1234567 or +92 300 1234567.", "phone");
            }

            var email = Clean(dto.Email);
            if (email != null && (email.Length > 100 || !Regex.IsMatch(email, @"^[^@\s]+@[^@\s]+\.[^@\s]+$")))
                return Fail("Enter a valid email address, eg info@company.com.", "email");

            var website = Clean(dto.Website);
            if (website != null && (website.Length > 100 ||
                !Regex.IsMatch(website, @"^(https?://)?([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(/\S*)?$", RegexOptions.IgnoreCase)))
                return Fail("Enter a valid website, eg www.company.com.", "website");

            // Tax registration (Pakistan)
            var ntn = Clean(dto.NTN);
            if (ntn != null && !Regex.IsMatch(ntn, @"^(\d{7}(-\d)?|\d{5}-?\d{7}-?\d)$"))
                return Fail("Enter a valid NTN: 7 digits (1234567 or 1234567-8), or a 13-digit CNIC.", "ntn");

            var strn = Clean(dto.STRN);
            if (strn != null && (!Regex.IsMatch(strn, @"^[0-9\s-]+$") || Regex.Replace(strn, @"\D", "").Length != 13))
                return Fail("Enter a valid STRN: 13 digits, eg 17-00-3764-523-19.", "strn");

            // Logo
            string? logo = string.IsNullOrWhiteSpace(dto.Logo) ? null : dto.Logo.Trim();
            if (logo != null)
            {
                var prefix = LogoPrefixes.FirstOrDefault(p => logo.StartsWith(p, StringComparison.OrdinalIgnoreCase));
                if (prefix == null) return Fail("The logo must be a PNG, JPG or WebP image.", "logo");
                if (logo.Length > CompanyOptions.MaxLogoLength) return Fail("The logo is too large. Use a smaller image.", "logo");
                var data = logo[prefix.Length..];
                var buffer = new byte[data.Length];
                if (!Convert.TryFromBase64String(data, buffer, out _)) return Fail("The logo image could not be read.", "logo");
            }

            // Currency
            var currency = Clean(dto.CurrencyCode)?.ToUpperInvariant();
            if (currency == null || !CompanyOptions.Currencies.ContainsKey(currency))
                return Fail("Choose a currency from the list.", "currencyCode");

            // Invoices
            var invoicePrefix = Clean(dto.InvoicePrefix)?.ToUpperInvariant();
            if (invoicePrefix == null) return Fail("Enter the invoice number prefix, eg INV.", "invoicePrefix");
            if (!Regex.IsMatch(invoicePrefix, @"^[A-Z][A-Z0-9-]{0,9}$") || invoicePrefix.EndsWith('-') || invoicePrefix.Contains("--"))
                return Fail("Use 1 to 10 letters, digits or single dashes, starting with a letter, eg INV.", "invoicePrefix");

            if (dto.DefaultTaxPercent < 0 || dto.DefaultTaxPercent > 100)
                return Fail("The default tax must be between 0% and 100%.", "defaultTaxPercent");
            if (Math.Round(dto.DefaultTaxPercent, 2) != dto.DefaultTaxPercent)
                return Fail("Use at most 2 decimal places, eg 16 or 17.5.", "defaultTaxPercent");

            var terms = string.IsNullOrWhiteSpace(dto.InvoiceTerms) ? null : dto.InvoiceTerms.Trim();
            if (terms != null && terms.Length > 500) return Fail("The invoice terms can be at most 500 characters.", "invoiceTerms");

            // Bank: all or nothing, so an invoice never shows half the payment details
            var bankName = Clean(dto.BankName);
            var accountTitle = Clean(dto.BankAccountTitle);
            var accountNumber = Clean(dto.BankAccountNumber);
            var iban = Clean(dto.BankIBAN);
            bool anyBank = bankName != null || accountTitle != null || accountNumber != null || iban != null;
            if (anyBank)
            {
                if (bankName == null) return Fail("Enter the bank name, or clear all the bank details.", "bankName");
                if (bankName.Length > 100 || !Regex.IsMatch(bankName, @"\p{L}")) return Fail("Enter a valid bank name.", "bankName");
                if (accountTitle == null) return Fail("Enter the account title (the name on the account).", "bankAccountTitle");
                if (accountTitle.Length > 100 || !Regex.IsMatch(accountTitle, @"\p{L}")) return Fail("Enter a valid account title.", "bankAccountTitle");
                if (accountNumber == null && iban == null) return Fail("Enter the account number or the IBAN.", "bankAccountNumber");
            }
            if (accountNumber != null)
            {
                var digits = Regex.Replace(accountNumber, @"\D", "").Length;
                if (!Regex.IsMatch(accountNumber, @"^[0-9\s-]+$") || digits < 6 || digits > 24)
                    return Fail("Enter a valid account number (6 to 24 digits, spaces and dashes allowed).", "bankAccountNumber");
            }
            if (iban != null)
            {
                iban = Regex.Replace(iban, @"\s+", "").ToUpperInvariant();
                if (!IsValidIban(iban))
                    return Fail("Enter a valid IBAN, eg PK36SCBL0000001123456702 (24 characters for Pakistan).", "bankIBAN");
            }

            var settings = new CompanySetting
            {
                CompanyName = name,
                Tagline = tagline,
                Logo = logo,
                Address = address,
                City = city,
                Phone = phone,
                Email = email,
                Website = website,
                NTN = ntn,
                STRN = strn,
                CurrencyCode = currency,
                InvoicePrefix = invoicePrefix,
                DefaultTaxPercent = dto.DefaultTaxPercent,
                InvoiceTerms = terms,
                BankName = bankName,
                BankAccountTitle = accountTitle,
                BankAccountNumber = accountNumber,
                BankIBAN = iban,
                // Kept as it is: the weekly off days are edited in Settings > Calendar
                WeeklyOffDays = current.WeeklyOffDays,
                UpdatedAt = DateTime.Now,
                UpdatedBy = Clean(updatedBy) ?? "Admin"
            };
            await _repository.SaveAsync(settings);
            return (await GetAsync(), null, null);
        }

        private static (CompanySettingsDto?, string?, string?) Fail(string message, string field) => (null, message, field);

        // IBAN check: country code, check digits, then the ISO 13616 mod-97 test.
        // Pakistani IBANs are always 24 characters.
        private static bool IsValidIban(string iban)
        {
            if (!Regex.IsMatch(iban, @"^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$")) return false;
            if (iban.StartsWith("PK") && iban.Length != 24) return false;
            var moved = iban[4..] + iban[..4];
            int remainder = 0;
            foreach (var ch in moved)
            {
                var part = char.IsDigit(ch) ? (ch - '0').ToString() : (ch - 'A' + 10).ToString();
                foreach (var d in part) remainder = (remainder * 10 + (d - '0')) % 97;
            }
            return remainder == 1;
        }

        // Helpers

        private async Task<string> NextNumberAsync(CompanySetting settings)
        {
            int seq = Math.Max(settings.LastInvoiceSeq, await _billingRepository.MaxInvoiceSeqAsync()) + 1;
            return $"{settings.InvoicePrefix}-{seq:0000}";
        }

        private static string? Clean(string? value) =>
            string.IsNullOrWhiteSpace(value) ? null : Regex.Replace(value.Trim(), @"[ \t]+", " ");

        private static void FillBrand(CompanyBrandDto dto, CompanySetting s)
        {
            var (symbol, word) = CompanyOptions.Currency(s.CurrencyCode);
            dto.CompanyName = s.CompanyName;
            dto.Tagline = s.Tagline;
            dto.Logo = s.Logo;
            dto.Address = s.Address;
            dto.City = s.City;
            dto.Phone = s.Phone;
            dto.Email = s.Email;
            dto.Website = s.Website;
            dto.NTN = s.NTN;
            dto.STRN = s.STRN;
            dto.CurrencyCode = s.CurrencyCode;
            dto.CurrencySymbol = symbol;
            dto.CurrencyWord = word;
            dto.InvoiceTerms = s.InvoiceTerms;
            dto.BankName = s.BankName;
            dto.BankAccountTitle = s.BankAccountTitle;
            dto.BankAccountNumber = s.BankAccountNumber;
            dto.BankIBAN = s.BankIBAN;
        }

        private static CompanySettingsDto ToDto(CompanySetting s)
        {
            var dto = new CompanySettingsDto
            {
                InvoicePrefix = s.InvoicePrefix,
                DefaultTaxPercent = s.DefaultTaxPercent,
                UpdatedBy = s.UpdatedBy
            };
            FillBrand(dto, s);
            return dto;
        }
    }
}
