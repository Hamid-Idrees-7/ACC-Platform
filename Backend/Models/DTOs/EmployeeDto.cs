namespace Backend.Models.DTOs
{
    // Used when sending employee data out to the frontend
    public class EmployeeDto
    {
        public int EmployeeID { get; set; }
        public string FullName { get; set; } = string.Empty;
        public string Phone { get; set; } = string.Empty;
        public string? SecondaryPhone { get; set; }
        public string? CNIC { get; set; }
        public string? Email { get; set; }
        public string? Address { get; set; }
        public string? City { get; set; }
        public string Designation { get; set; } = string.Empty;
        public DateTime? JoiningDate { get; set; }
        public string Status { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
    }
}