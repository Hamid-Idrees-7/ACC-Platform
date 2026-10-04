using Backend.Models.DTOs;
using Backend.Models.Entities;

namespace Backend.Services
{
    public interface IClientService
    {
        Task<IEnumerable<Client>> GetAllClientsAsync();
        Task<Client?> GetClientByIdAsync(int id);
        Task<Client> CreateClientAsync(ClientDto dto);
        Task<Client?> UpdateClientAsync(int id, ClientDto dto);
        Task<bool> DeleteClientAsync(int id);
        Task<string?> CheckAsync(ClientDto dto, int? id);
        Task<IDisposable> LockAsync();
    }
}