namespace Backend.Models.DTOs
{
    public class MaterialTransactionDto
    {
        public int TransactionID { get; set; }
        public string Type { get; set; } = string.Empty;
        public decimal Quantity { get; set; }
        public decimal Rate { get; set; }
        public string? ProjectName { get; set; }
        public string? Note { get; set; }
        public DateTime CreatedAt { get; set; }
        public decimal Amount { get; set; }
    }
}
