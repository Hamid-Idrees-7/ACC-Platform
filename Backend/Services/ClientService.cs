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
                Status = CleanStatus(dto.Status),
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
                Status = CleanStatus(dto.Status)
            };

            return await _repository.UpdateAsync(client);
        }

        public async Task<bool> DeleteClientAsync(int id)
        {
            return await _repository.DeleteAsync(id);
        }

        // Held around the duplicate check and the save
        public Task<IDisposable> LockAsync() => Locks.ForRecordsAsync(_repository.DatabaseName, "clients");

        // The same CNIC can't belong to two clients (dashes and spaces are ignored)
        public async Task<string?> CheckAsync(ClientDto dto, int? id)
        {
            var cnic = Digits(dto.CNIC);
            if (cnic.Length == 0) return null;
            var same = (await _repository.GetAllAsync()).FirstOrDefault(c => c.ClientID != id && Digits(c.CNIC) == cnic);
            return same == null ? null : $"{same.FullName} already has this CNIC.";
        }

        private static string Digits(string? value) => new((value ?? "").Where(char.IsDigit).ToArray());

        // Active or Inactive only
        private static string CleanStatus(string? status) =>
            string.Equals(status?.Trim(), "Inactive", StringComparison.OrdinalIgnoreCase) ? "Inactive" : "Active";
    }
}