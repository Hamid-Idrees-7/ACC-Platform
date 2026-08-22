namespace Backend.Models.DTOs
{
    public class ReorderPhasesDto
    {
        // Phase IDs in their new top-to-bottom order.
        public List<int> PhaseIDs { get; set; } = new();
    }
}
