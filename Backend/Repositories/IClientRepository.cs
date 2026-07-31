using Backend.Models.Entities;

namespace Backend.Repositories
{
    // Contract for client database operations.
    // Defines WHAT operations exist (the actual code is in ClientRepository).
    public interface IClientRepository
    {
        // Get all clients from the database
        Task<IEnumerable<Client>> GetAllAsync();

        // Get a single client by its ID (returns null if not found)
        Task<Client?> GetByIdAsync(int id);

        // Add a new client and return it
        Task<Client> AddAsync(Client client);

        // Update an existing client
        Task<Client?> UpdateAsync(Client client);

        // Delete a client by ID (returns true if deleted)
        Task<bool> DeleteAsync(int id);
    }
}