namespace Backend.Ai
{
    // A rough construction cost estimate from a simple per square foot rate. The numbers come
    // from here, never from the AI, so the figures are consistent and honest. Rough 2026 Lahore
    // all-in rates (material plus labour) for the construction only, clearly labelled an estimate.
    // Land, furniture, approvals and taxes are not included.
    public static class CostEstimator
    {
        // Covered (built) area per marla, per storey. A plot is never fully covered (margins,
        // stairs, open areas), so a 5 marla double storey works out to about 1,900 sq ft.
        private const int CoveredSqFtPerMarlaPerStorey = 190;

        public static object Estimate(double areaMarla, int storeys, string? finish)
        {
            if (areaMarla <= 0) areaMarla = 1;
            if (storeys <= 0) storeys = 1;
            if (storeys > 10) storeys = 10;

            // Rough 2026 Lahore rates, Rs per covered sq ft.
            var (label, rate) = (finish ?? "").Trim().ToLowerInvariant() switch
            {
                "grey" or "gray" or "grey structure" or "structure" => ("Grey structure (no finishing)", 2600),
                "luxury" or "premium" or "high end" or "high-end" => ("Luxury finish", 7200),
                _ => ("Standard finish", 4500),
            };

            double covered = areaMarla * storeys * CoveredSqFtPerMarlaPerStorey;
            double baseCost = covered * rate;

            return new
            {
                area_marla = areaMarla,
                storeys,
                finish = label,
                covered_sqft = (long)covered,
                rate_per_sqft = rate,
                currency = "PKR",
                estimate_low = RoundTo(baseCost * 0.85, 50000),
                estimate_high = RoundTo(baseCost * 1.15, 50000),
                includes = "Construction only (material and labour).",
                excludes = "Land, furniture, approvals and taxes are not included.",
                disclaimer = "Rough estimate only. The real cost depends on the design, materials, finish and site, and can vary by 20 to 30 percent. Share details with the team for a proper quote."
            };
        }

        private static long RoundTo(double value, long step) => (long)(System.Math.Round(value / step) * step);
    }
}
