namespace Backend.Models.DTOs
{
    public class ProjectFinancialsDto
    {
        public decimal Budget { get; set; }
        public decimal MaterialCost { get; set; }
        public decimal LabourCost { get; set; }
        public decimal ActualCost { get; set; }
        public decimal Profit { get; set; }
        public decimal MarginPercent { get; set; }
    }
}
