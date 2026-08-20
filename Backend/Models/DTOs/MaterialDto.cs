namespace Backend.Models.DTOs
{
    public class MaterialDto
    {
        public int MaterialID { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
        public string Unit { get; set; } = string.Empty;
        public int LowStockThreshold { get; set; }
        public string Status { get; set; } = string.Empty;

        // Derived from the transaction ledger, not stored on the entity.
        public decimal CurrentStock { get; set; }

        // Weighted average purchase cost per unit, and stock at that cost.
        public decimal AvgCost { get; set; }
        public decimal StockValue { get; set; }

        public DateTime CreatedAt { get; set; }
    }
}
