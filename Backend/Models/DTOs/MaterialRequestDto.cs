namespace Backend.Models.DTOs
{
    // Engineer raising a request (data IN). ProjectID comes from the route.
    public class CreateMaterialRequestDto
    {
        public int MaterialID { get; set; }
        public int? PhaseID { get; set; }
        public decimal Quantity { get; set; }
        public string? Note { get; set; }
    }

    // Admin resolving (reject reason / approve note).
    public class ResolveRequestDto
    {
        public string? Note { get; set; }
    }

    // A material request with all display names resolved (data OUT).
    public class MaterialRequestDto
    {
        public int RequestID { get; set; }
        public int ProjectID { get; set; }
        public string ProjectTitle { get; set; } = string.Empty;
        public int? PhaseID { get; set; }
        public string? PhaseName { get; set; }
        public int MaterialID { get; set; }
        public string MaterialName { get; set; } = string.Empty;
        public string Unit { get; set; } = string.Empty;
        public decimal Quantity { get; set; }
        public string? Note { get; set; }
        public string RequestedByName { get; set; } = string.Empty;
        public string Status { get; set; } = "Pending";
        public string? ResolveNote { get; set; }
        public decimal AvailableStock { get; set; }   // current stock, so the admin sees if it can be met
        public DateTime CreatedAt { get; set; }
        public DateTime? ResolvedAt { get; set; }
    }

    // What the engineer's request form needs: pickable materials + this project's phases.
    public class FieldRequestOptionsDto
    {
        public List<MaterialDto> Materials { get; set; } = new();
        public List<ProjectPhaseDto> Phases { get; set; } = new();
    }
}
