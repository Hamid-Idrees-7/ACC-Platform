using Backend.Data;
using Backend.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace Backend.Repositories
{
    // Database access for clients. Only this layer talks to the DbContext.
    public class ClientRepository : IClientRepository
    {
        private readonly AppDbContext _context;

        public ClientRepository(AppDbContext context)
        {
            _context = context;
        }

        // Newest first
        public async Task<IEnumerable<Client>> GetAllAsync()
        {
            return await _context.Clients
                .OrderByDescending(c => c.CreatedAt)
                .ToListAsync();
        }

        public async Task<Client?> GetByIdAsync(int id)
        {
            return await _context.Clients.FindAsync(id);
        }

        public async Task<Client> AddAsync(Client client)
        {
            _context.Clients.Add(client);
            await _context.SaveChangesAsync();
            return client;
        }

        public async Task<Client?> UpdateAsync(Client client)
        {
            var existing = await _context.Clients.FindAsync(client.ClientID);
            if (existing == null) return null;

            existing.FullName = client.FullName;
            existing.Email = client.Email;
            existing.Phone = client.Phone;
            existing.SecondaryPhone = client.SecondaryPhone;
            existing.CNIC = client.CNIC;
            existing.Address = client.Address;
            existing.City = client.City;
            existing.ClientType = client.ClientType;
            existing.Status = client.Status;
            existing.UpdatedAt = DateTime.Now;

            await _context.SaveChangesAsync();
            return existing;
        }

        public async Task<bool> DeleteAsync(int id)
        {
            var client = await _context.Clients.FindAsync(id);
            if (client == null) return false;

            _context.Clients.Remove(client);
            await _context.SaveChangesAsync();
            return true;
        }
    }
}