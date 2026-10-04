using Backend.Data;
using Backend.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace Backend.Repositories
{
    public class UserRepository : IUserRepository
    {
        public string DatabaseName => _context.Database.GetDbConnection().Database;

        private readonly AppDbContext _context;

        public UserRepository(AppDbContext context)
        {
            _context = context;
        }

        public async Task<List<User>> GetAllAsync()
        {
            return await _context.Users
                .OrderByDescending(u => u.UserID)
                .ToListAsync();
        }

        public async Task<User?> GetByIdAsync(int id)
        {
            return await _context.Users.FindAsync(id);
        }

        // Every user without the picture and password, for lookups that only need names and roles.
        public async Task<List<User>> GetAllLightAsync()
        {
            return await _context.Users
                .AsNoTracking()
                .OrderByDescending(u => u.UserID)
                .Select(u => new User
                {
                    UserID = u.UserID,
                    Username = u.Username,
                    FullName = u.FullName,
                    Email = u.Email,
                    Role = u.Role,
                    EmployeeID = u.EmployeeID,
                    IsActive = u.IsActive
                })
                .ToListAsync();
        }

        // Null when the user doesn't exist.
        public async Task<bool?> GetIsActiveAsync(int id)
        {
            return await _context.Users
                .Where(u => u.UserID == id)
                .Select(u => (bool?)u.IsActive)
                .FirstOrDefaultAsync();
        }

        public async Task<User> AddAsync(User user)
        {
            _context.Users.Add(user);
            await _context.SaveChangesAsync();
            return user;
        }

        public async Task UpdateAsync(User user)
        {
            _context.Users.Update(user);
            await _context.SaveChangesAsync();
        }

        public async Task<bool> DeleteAsync(int id)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null) return false;

            _context.Users.Remove(user);
            await _context.SaveChangesAsync();
            return true;
        }

        // excludeUserId skips one user, for edits
        public async Task<bool> UsernameExistsAsync(string username, int? excludeUserId = null)
        {
            return await _context.Users
                .AnyAsync(u => u.Username == username && u.UserID != excludeUserId);
        }
    }
}