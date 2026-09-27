using Backend.Models.DTOs;

namespace Backend.Services
{
    public interface ICompanySettingsService
    {
        // Settings > Company (the saved values, or the defaults before the first save).
        Task<CompanySettingsDto> GetAsync();

        // Just what printed documents need (name, logo, address, bank, currency).
        Task<CompanyBrandDto> GetBrandAsync();

        // Validates and saves. Returns the saved settings, or an error message and the
        // name of the field it belongs to (so the page can show it under that field).
        Task<(CompanySettingsDto? Saved, string? Error, string? Field)> SaveAsync(SaveCompanySettingsDto dto, string? updatedBy);

        // The number for a new invoice, eg INV-0042.
        Task<string> NewInvoiceNumberAsync();

        // An amount with the company currency, eg "Rs. 25,000" (used in notification texts).
        Task<string> FormatMoneyAsync(decimal amount);
    }
}
