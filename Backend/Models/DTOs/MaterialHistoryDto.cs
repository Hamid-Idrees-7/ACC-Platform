namespace Backend.Models.DTOs
{
    public class MaterialHistoryDto
    {
        public int MaterialID { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Unit { get; set; } = string.Empty;
        public decimal CurrentStock { get; set; }
        public decimal AvgCost { get; set; }

        public decimal TotalPurchasedQty { get; set; }
        public decimal TotalInvested { get; set; }
        public decimal MinRate { get; set; }
        public decimal MaxRate { get; set; }

        public decimal TotalIssuedQty { get; set; }
        public decimal TotalIssuedCost { get; set; }

        public int TotalTransactions { get; set; }
        public List<MaterialTransactionDto> Transactions { get; set; } = new();
    }
}
