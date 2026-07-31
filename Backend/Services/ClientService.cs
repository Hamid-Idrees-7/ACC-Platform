using Backend.Models.DTOs;
using Backend.Models.Entities;
using Backend.Repositories;

namespace Backend.Services
{
    // Handles client business logic. Sits between the Controller and the Repository.
    public class ClientService : IClientService
    {
        private readonly IClientRepository _repository;

        // The repository is injected here (Dependency Injection)
        public ClientService(IClientRepository repository)
        {
            _repository = repository;
        }

        // Get all clients
        public async Task<IEnumerable<Client>> GetAllClientsAsync()
        {
            return await _repository.GetAllAsync();
        }

        // Get one client by ID
        public async Task<Client?> GetClientByIdAsync(int id)
        {
            return await _repository.GetByIdAsync(id);
        }

        // Create a new client from the incoming DTO
        public async Task<Client> CreateClientAsync(ClientDto dto)
        {
            // Convert the DTO (incoming data) into a full Client entity
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
                CreatedAt = DateTime.Now,
                UpdatedAt = DateTime.Now
            };

            return await _repository.AddAsync(client);
        }

        // Update an existing client
        public async Task<Client?> UpdateClientAsync(int id, ClientDto dto)
        {
            // Build a client object with the new values
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

        // Delete a client
        public async Task<bool> DeleteClientAsync(int id)
        {
            return await _repository.DeleteAsync(id);
        }
    }
}