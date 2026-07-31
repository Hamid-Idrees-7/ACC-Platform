using Backend.Data;
using Backend.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace Backend.Repositories
{
    // The actual implementation of client database operations.
    // This is the ONLY layer that talks directly to the database (via DbContext).
    public class ClientRepository : IClientRepository
    {
        private readonly AppDbContext _context;

        // The database context is injected here (Dependency Injection)
        public ClientRepository(AppDbContext context)
        {
            _context = context;
        }

        // Return all clients, newest first
        public async Task<IEnumerable<Client>> GetAllAsync()
        {
            return await _context.Clients
                .OrderByDescending(c => c.CreatedAt)
                .ToListAsync();
        }

        // Find one client by ID
        public async Task<Client?> GetByIdAsync(int id)
        {
            return await _context.Clients.FindAsync(id);
        }

        // Add a new client to the database
        public async Task<Client> AddAsync(Client client)
        {
            _context.Clients.Add(client);
            await _context.SaveChangesAsync();
            return client;
        }

        // Update an existing client
        public async Task<Client?> UpdateAsync(Client client)
        {
            var existing = await _context.Clients.FindAsync(client.ClientID);
            if (existing == null) return null;

            // Copy new values onto the existing record
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

        // Delete a client by ID
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