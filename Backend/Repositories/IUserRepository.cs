using Backend.Models.Entities;

namespace Backend.Repositories
{
    public interface IUserRepository
    {
        Task<List<User>> GetAllAsync();
        Task<User?> GetByIdAsync(int id);
        Task<List<User>> GetAllLightAsync();
        Task<bool?> GetIsActiveAsync(int id);
        Task<User> AddAsync(User user);
        Task UpdateAsync(User user);
        Task<bool> DeleteAsync(int id);
        Task<bool> UsernameExistsAsync(string username, int? excludeUserId = null);
    }
}