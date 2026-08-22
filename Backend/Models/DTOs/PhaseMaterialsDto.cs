namespace Backend.Models.DTOs
{
    public class PhaseMaterialsDto
    {
        public string PhaseName { get; set; } = string.Empty;
        public decimal Subtotal { get; set; }
        public List<PhaseMaterialLineDto> Items { get; set; } = new();
    }

    public class PhaseMaterialLineDto
    {
        public string MaterialName { get; set; } = string.Empty;
        public string Unit { get; set; } = string.Empty;
        public decimal Quantity { get; set; }
        public decimal Amount { get; set; }
    }
}
