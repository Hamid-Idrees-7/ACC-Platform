using Backend.Data;
using Backend.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace Backend.Repositories
{
    public class InquiryRepository : IInquiryRepository
    {
        private readonly AppDbContext _context;

        public InquiryRepository(AppDbContext context)
        {
            _context = context;
        }

        public async Task<Inquiry> AddAsync(Inquiry inquiry)
        {
            _context.Inquiries.Add(inquiry);
            await _context.SaveChangesAsync();
            return inquiry;
        }

        public async Task UpdateAsync(Inquiry inquiry)
        {
            _context.Inquiries.Update(inquiry);
            await _context.SaveChangesAsync();
        }

        public async Task<List<Inquiry>> GetAllAsync()
        {
            return await _context.Inquiries
                .OrderByDescending(i => i.CreatedAt)
                .ToListAsync();
        }

        public async Task<Inquiry?> GetByIdAsync(int id)
        {
            return await _context.Inquiries.FindAsync(id);
        }

        public async Task<bool> DeleteAsync(int id)
        {
            var inquiry = await _context.Inquiries.FindAsync(id);
            if (inquiry == null) return false;

            _context.Inquiries.Remove(inquiry);
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task DeleteAllAsync()
        {
            var all = await _context.Inquiries.ToListAsync();
            _context.Inquiries.RemoveRange(all);
            await _context.SaveChangesAsync();
        }

        public async Task<int> GetUnreadCountAsync()
        {
            return await _context.Inquiries.CountAsync(i => !i.IsRead);
        }

        public async Task<int> CountRecentByPhoneAsync(string phone, DateTime since)
        {
            return await _context.Inquiries
                .CountAsync(i => i.Phone == phone && i.CreatedAt >= since);
        }
    }
}