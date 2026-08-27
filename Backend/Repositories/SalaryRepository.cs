using Backend.Data;
using Backend.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace Backend.Repositories
{
    public class SalaryRepository : ISalaryRepository
    {
        private readonly AppDbContext _context;

        public SalaryRepository(AppDbContext context)
        {
            _context = context;
        }

        public async Task<List<SalaryPayment>> GetForPeriodAsync(int year, int month)
        {
            return await _context.SalaryPayments
                .Where(p => p.Year == year && p.Month == month)
                .ToListAsync();
        }

        public async Task<SalaryPayment?> GetByIdAsync(int paymentId)
        {
            return await _context.SalaryPayments.FindAsync(paymentId);
        }

        public async Task AddAsync(SalaryPayment payment)
        {
            _context.SalaryPayments.Add(payment);
            await _context.SaveChangesAsync();
        }

        public async Task<bool> DeleteAsync(int paymentId)
        {
            var payment = await _context.SalaryPayments.FindAsync(paymentId);
            if (payment == null) return false;

            _context.SalaryPayments.Remove(payment);
            await _context.SaveChangesAsync();
            return true;
        }
    }
}
