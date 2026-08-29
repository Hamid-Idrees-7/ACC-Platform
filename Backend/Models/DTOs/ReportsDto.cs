namespace Backend.Models.DTOs
{
    // The complete company report — everything the Reports page needs in one payload.
    // All figures are computed server-side and reuse the same logic as the individual
    // modules (project financials, billing overview), so numbers match across the app.
    public class ReportsDto
    {
        public FinancialReportDto Financial { get; set; } = new();
        public List<ProjectReportRowDto> Projects { get; set; } = new();
        public MaterialsReportDto Materials { get; set; } = new();
        public WorkforceReportDto Workforce { get; set; } = new();
        public DateTime GeneratedAt { get; set; } = DateTime.Now;
    }

    // Financial
    public class FinancialReportDto
    {
        public decimal TotalBudget { get; set; }     // sum of project budgets (the agreed prices)
        public decimal MaterialCost { get; set; }
        public decimal LabourCost { get; set; }
        public decimal TotalCost { get; set; }        // material + labour
        public decimal TotalProfit { get; set; }      // budget - cost
        public decimal MarginPercent { get; set; }

        public decimal TotalBilled { get; set; }      // from billing
        public decimal TotalReceived { get; set; }
        public decimal Outstanding { get; set; }
        public decimal Overdue { get; set; }

        public int ProjectCount { get; set; }       // all projects in the system
        public int LiveProjects { get; set; }        // non-cancelled (counted in the money totals)
        public int CancelledProjects { get; set; }
        public int ActiveProjects { get; set; }
        public int CompletedProjects { get; set; }

        // Last 6 months of billed vs received (for the trend chart).
        public List<MonthPointDto> RevenueTrend { get; set; } = new();
        // Count of projects per status (for the status pie).
        public List<SliceDto> ProjectStatus { get; set; } = new();
    }

    public class MonthPointDto
    {
        public string Label { get; set; } = string.Empty;  // e.g. "Aug 26"
        public decimal Billed { get; set; }
        public decimal Received { get; set; }
    }

    public class SliceDto
    {
        public string Label { get; set; } = string.Empty;
        public decimal Value { get; set; }
    }

    // Projects
    public class ProjectReportRowDto
    {
        public int ProjectID { get; set; }
        public string Title { get; set; } = string.Empty;
        public string ClientName { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public int Progress { get; set; }
        public decimal Budget { get; set; }
        public decimal Cost { get; set; }
        public decimal Profit { get; set; }
        public decimal MarginPercent { get; set; }
        public decimal Billed { get; set; }
        public decimal Received { get; set; }
        public decimal Outstanding { get; set; }
    }

    // Materials
    public class MaterialsReportDto
    {
        public int TotalMaterials { get; set; }
        public int LowStock { get; set; }
        public int OutOfStock { get; set; }
        public decimal InventoryValue { get; set; }   // current stock valued at weighted-avg cost
        public decimal TotalPurchased { get; set; }   // total money spent restocking
        public decimal TotalIssued { get; set; }      // value issued out to projects
        public List<MaterialReportRowDto> TopMaterials { get; set; } = new();
        public List<SliceDto> ByCategory { get; set; } = new();  // inventory value per category
    }

    public class MaterialReportRowDto
    {
        public int MaterialID { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
        public string Unit { get; set; } = string.Empty;
        public decimal Stock { get; set; }
        public decimal AvgCost { get; set; }
        public decimal InventoryValue { get; set; }
        public decimal Purchased { get; set; }
        public decimal Issued { get; set; }
        public string StockState { get; set; } = "OK";   // OK / Low / Out
    }

    // Workforce
    public class WorkforceReportDto
    {
        public int TotalEmployees { get; set; }
        public int ActiveEmployees { get; set; }
        public int TotalAssignments { get; set; }
        public int ActiveAssignments { get; set; }

        public int PresentCount { get; set; }
        public int AbsentCount { get; set; }
        public decimal PresentRate { get; set; }         // present / (present + absent) * 100

        public string PayrollPeriod { get; set; } = string.Empty;   // e.g. "August 2026"
        public decimal PayrollTotal { get; set; }
        public decimal PayrollPaid { get; set; }
        public decimal PayrollPending { get; set; }

        public List<SliceDto> LabourByProject { get; set; } = new();   // labour cost per project
        public List<SliceDto> ByDesignation { get; set; } = new();     // employee count per designation
    }
}
