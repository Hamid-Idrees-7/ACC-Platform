using Backend.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace Backend.Data
{
    // The database context - the main bridge between our C# code and the SQL Server database.
    // EF Core uses this class to know which tables exist and to run all queries.
    public class AppDbContext : DbContext
    {
        // Constructor - receives database configuration (like the connection string) from Program.cs
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
        {
        }

        // Each DbSet represents a table in the database.
        // "Clients" is the table name; it holds records of type Client.
        public DbSet<Client> Clients { get; set; }
    }
}