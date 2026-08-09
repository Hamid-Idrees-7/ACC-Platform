using Backend.Models.Entities;

namespace Backend.Repositories
{
    public interface IInquiryRepository
    {
        Task<Inquiry> AddAsync(Inquiry inquiry);
        Task<List<Inquiry>> GetAllAsync();
        Task<Inquiry?> GetByIdAsync(int id);
        Task UpdateAsync(Inquiry inquiry);        
        Task<bool> DeleteAsync(int id);
        Task DeleteAllAsync();
        Task<int> GetUnreadCountAsync();
        Task<int> CountRecentByPhoneAsync(string phone, DateTime since);
    }
}