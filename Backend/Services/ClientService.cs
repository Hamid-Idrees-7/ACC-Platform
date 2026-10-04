using Backend.Models.DTOs;
using Backend.Models.Entities;
using Backend.Repositories;

namespace Backend.Services
{
    // Client logic that sits between the controller and the repository.
    public class ClientService : IClientService
    {
        private readonly IClientRepository _repository;

        public ClientService(IClientRepository repository)
        {
            _repository = repository;
        }

        public async Task<IEnumerable<Client>> GetAllClientsAsync()
        {
            return await _repository.GetAllAsync();
        }

        public async Task<Client?> GetClientByIdAsync(int id)
        {
            return await _repository.GetByIdAsync(id);
        }

        public async Task<Client> CreateClientAsync(ClientDto dto)
        {
            var client = new Client
            {
                FullName = dto.FullName,
                Email = dto.Email,
                Phone = dto.Phone,
                SecondaryPhone = dto.SecondaryPhone,
                CNIC = dto.CNIC,
                Address = dto.Address,
                City = dto.City,
                ClientType = dto.ClientType,
                Status = dto.Status,
                CreatedAt = AppTime.Now,
                UpdatedAt = AppTime.Now
            };

            return await _repository.AddAsync(client);
        }

        public async Task<Client?> UpdateClientAsync(int id, ClientDto dto)
        {
            var client = new Client
            {
                ClientID = id,
                FullName = dto.FullName,
                Email = dto.Email,
                Phone = dto.Phone,
                SecondaryPhone = dto.SecondaryPhone,
                CNIC = dto.CNIC,
                Address = dto.Address,
                City = dto.City,
                ClientType = dto.ClientType,
                Status = dto.Status
            };

            return await _repository.UpdateAsync(client);
        }

        public async Task<bool> DeleteClientAsync(int id)
        {
            return await _repository.DeleteAsync(id);
        }
    }
}