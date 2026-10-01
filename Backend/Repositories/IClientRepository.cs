using Backend.Models.Entities;

namespace Backend.Repositories
{
    // Database operations for clients (implemented in ClientRepository).
    public interface IClientRepository
    {
        Task<IEnumerable<Client>> GetAllAsync();

        // Null when not found
        Task<Client?> GetByIdAsync(int id);

        Task<Client> AddAsync(Client client);

        Task<Client?> UpdateAsync(Client client);

        // True when a row was deleted
        Task<bool> DeleteAsync(int id);
    }
}