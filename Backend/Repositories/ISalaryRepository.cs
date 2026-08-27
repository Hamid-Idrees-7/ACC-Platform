using Backend.Models.Entities;

namespace Backend.Repositories
{
    public interface ISalaryRepository
    {
        Task<List<SalaryPayment>> GetForPeriodAsync(int year, int month);
        Task<SalaryPayment?> GetByIdAsync(int paymentId);
        Task AddAsync(SalaryPayment payment);
        Task<bool> DeleteAsync(int paymentId);
    }
}
