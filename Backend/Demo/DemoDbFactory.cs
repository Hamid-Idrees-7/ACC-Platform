using System.Text.RegularExpressions;
using Backend.Data;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace Backend.Demo
{
    // Builds AppDbContext instances for a specific database (the main one or a visitor's) and
    // creates/drops visitor databases. Used by the demo infrastructure outside normal requests.
    public class DemoDbFactory
    {
        public const string DatabasePrefix = "ACC_Demo_";

        // Visitor databases always match this exact shape. Anything else is never touched here.
        private static readonly Regex NamePattern = new("^ACC_Demo_[a-f0-9]{12}$", RegexOptions.Compiled);

        private readonly string _mainConnectionString;

        public DemoDbFactory(IConfiguration config)
        {
            _mainConnectionString = config.GetConnectionString("DefaultConnection")
                ?? throw new InvalidOperationException("ConnectionStrings:DefaultConnection is not configured.");
        }

        public string MainConnectionString => _mainConnectionString;

        public static bool IsValidName(string? name) => name != null && NamePattern.IsMatch(name);

        public static string NewDatabaseName() => DatabasePrefix + Guid.NewGuid().ToString("N")[..12];

        // Same server and credentials as the main database, different database name.
        public string ConnectionStringFor(string databaseName)
        {
            if (!IsValidName(databaseName))
                throw new InvalidOperationException("Invalid demo database name.");

            var builder = new SqlConnectionStringBuilder(_mainConnectionString) { InitialCatalog = databaseName };
            return builder.ConnectionString;
        }

        public AppDbContext CreateMain() => Create(_mainConnectionString);

        public AppDbContext CreateForDemo(string databaseName) => Create(ConnectionStringFor(databaseName));

        private static AppDbContext Create(string connectionString)
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseSqlServer(connectionString)
                .Options;
            return new AppDbContext(options);
        }

        // Every visitor database that physically exists on the server.
        public async Task<List<string>> ListDemoDatabasesAsync(CancellationToken ct = default)
        {
            await using var db = CreateMain();
            var names = await db.Database
                .SqlQueryRaw<string>("SELECT name AS [Value] FROM sys.databases WHERE name LIKE 'ACC[_]Demo[_]%'")
                .ToListAsync(ct);
            return names.Where(IsValidName).ToList();
        }

        // Drops one visitor database. The name is checked against the strict pattern first,
        // so the main database (or any other) can never be dropped through this method.
        public async Task DropDatabaseAsync(string databaseName, CancellationToken ct = default)
        {
            if (!IsValidName(databaseName))
                throw new InvalidOperationException("Refusing to drop a database that is not a demo database.");

            // Release this app's pooled connections to that database first.
            SqlConnection.ClearPool(new SqlConnection(ConnectionStringFor(databaseName)));

            await using var db = CreateMain();
            var exists = await db.Database
                .SqlQuery<int>($"SELECT COUNT(*) AS [Value] FROM sys.databases WHERE name = {databaseName}")
                .SingleAsync(ct);
            if (exists == 0) return;

            // The name has been validated above, so it is safe to place inside the brackets.
            var closeConnections = "ALTER DATABASE [" + databaseName + "] SET SINGLE_USER WITH ROLLBACK IMMEDIATE";
            var drop = "DROP DATABASE [" + databaseName + "]";

            try
            {
                // Disconnect anything still attached (not supported on every host, so failures are ignored).
                await db.Database.ExecuteSqlRawAsync(closeConnections, ct);
            }
            catch (SqlException)
            {
            }

            await db.Database.ExecuteSqlRawAsync(drop, ct);
        }
    }
}
