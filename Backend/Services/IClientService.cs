using Backend.Models.DTOs;
using Backend.Models.Entities;

namespace Backend.Services
{
    // Contract for client business logic.
    public interface IClientService
    {
        Task<IEnumerable<Client>> GetAllClientsAsync();
        Task<Client?> GetClientByIdAsync(int id);
        Task<Client> CreateClientAsync(ClientDto dto);
        Task<Client?> UpdateClientAsync(int id, ClientDto dto);
        Task<bool> DeleteClientAsync(int id);
    }
}