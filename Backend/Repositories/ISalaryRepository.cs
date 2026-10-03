using Backend.Models.Entities;

namespace Backend.Repositories
{
    public interface ISalaryRepository
    {
        Task<List<SalaryPayment>> GetForPeriodAsync(int year, int month);
        Task<SalaryPayment?> GetByIdAsync(int paymentId);
        Task AddAsync(SalaryPayment payment);

        Task<List<SalaryPayment>> GetForEmployeeAsync(int employeeId);
        Task<bool> AnyForAssignmentAsync(int assignmentId);
        Task<bool> DeleteAsync(int paymentId);

        // Used to key the pay lock per database
        string DatabaseName { get; }
    }
}
