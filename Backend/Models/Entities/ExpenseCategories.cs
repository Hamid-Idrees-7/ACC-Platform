namespace Backend.Models.Entities
{
    // The fixed list of project expense categories. A fixed list keeps reports clean
    // (no tax, taxes, tax fee duplicates); anything else goes under other
    // with the detail written in the description.
    public static class ExpenseCategories
    {
        public const string Other = "Other";

        public static readonly string[] All =
        {
            "Land & Plot",
            "Transfer & Registry Fees",
            "Taxes & Govt Duties",
            "Possession & Society Charges",
            "Approvals & NOC",
            "Utility Connections",
            "Equipment Rent",
            "Transport",
            "Subcontractor",
            "Site Running",
            Other
        };

        // Returns the category exactly as stored in the list (case-insensitive match), or null.
        public static string? Normalize(string? value)
        {
            if (string.IsNullOrWhiteSpace(value)) return null;
            var trimmed = value.Trim();
            return All.FirstOrDefault(c => string.Equals(c, trimmed, StringComparison.OrdinalIgnoreCase));
        }
    }
}
