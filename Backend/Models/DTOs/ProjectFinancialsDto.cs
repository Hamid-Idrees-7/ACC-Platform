namespace Backend.Models.DTOs
{
    public class ProjectFinancialsDto
    {
        public decimal Budget { get; set; }
        public decimal MaterialCost { get; set; }
        public decimal ContractLabour { get; set; }
        public decimal DailyLabour { get; set; }
        public decimal LabourCost { get; set; }

        // Company-borne project expenses (plot, transfer, taxes, possession...). Part of ActualCost.
        public decimal ExpenseCost { get; set; }
        // Expenses paid on the client's behalf. Billed back, so NOT part of ActualCost.
        public decimal RecoverableTotal { get; set; }
        public decimal RecoverableInvoiced { get; set; }

        // Material + labour + company expenses
        public decimal ActualCost { get; set; }
        public decimal Profit { get; set; }
        public decimal MarginPercent { get; set; }
    }
}
