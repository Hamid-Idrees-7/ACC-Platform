using System.Text.RegularExpressions;
using Backend.Data;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Backend.Demo
{
    // Builds AppDbContext instances for a specific schema (the main one or a visitor's) and
    // creates or drops visitor schemas. The demo code uses it outside normal requests.
    //
    // Every visitor lives in its own PostgreSQL schema inside the one main database, rather than
    // in a separate database. The main database uses the default "public" schema; a visitor uses
    // a schema named demo_<12 hex>. The connection string for a visitor is the main connection
    // string with its Search Path set to that schema, so the context resolves tables there.
    public class DemoDbFactory
    {
        public const string SchemaPrefix = "demo_";

        // Visitor schemas always match this exact shape. Anything else is never touched here.
        // Lowercase only: PostgreSQL folds unquoted identifiers to lowercase.
        private static readonly Regex NamePattern = new("^demo_[a-f0-9]{12}$", RegexOptions.Compiled);

        private readonly string _mainConnectionString;

        public DemoDbFactory(IConfiguration config)
        {
            _mainConnectionString = config.GetConnectionString("DefaultConnection")
                ?? throw new InvalidOperationException("ConnectionStrings:DefaultConnection is not configured.");
        }

        public string MainConnectionString => _mainConnectionString;

        public static bool IsValidName(string? name) => name != null && NamePattern.IsMatch(name);

        public static string NewDatabaseName() => SchemaPrefix + Guid.NewGuid().ToString("N")[..12];

        // Same server, database and credentials as the main connection, with the Search Path
        // pointed at the visitor's schema so every query resolves tables in that schema.
        public string ConnectionStringFor(string schemaName)
        {
            if (!IsValidName(schemaName))
                throw new InvalidOperationException("Invalid demo schema name.");

            var builder = new NpgsqlConnectionStringBuilder(_mainConnectionString) { SearchPath = schemaName };
            return builder.ConnectionString;
        }

        public AppDbContext CreateMain() => Create(_mainConnectionString);

        public AppDbContext CreateForDemo(string schemaName) => Create(ConnectionStringFor(schemaName));

        private static AppDbContext Create(string connectionString)
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseNpgsql(connectionString)
                .ReplaceService<Microsoft.EntityFrameworkCore.Infrastructure.IModelCacheKeyFactory, DemoSchemaModelCacheKeyFactory>()
                .Options;
            return new AppDbContext(options);
        }

        // Creates the empty schema for a visitor. The tables inside it are created elsewhere
        // (DemoManager) against a context built with ConnectionStringFor(name), whose default
        // schema is this one.
        public async Task CreateSchemaAsync(string schemaName, CancellationToken ct = default)
        {
            if (!IsValidName(schemaName))
                throw new InvalidOperationException("Invalid demo schema name.");

            await using var connection = new NpgsqlConnection(_mainConnectionString);
            await connection.OpenAsync(ct);
            // The name is validated against the strict pattern above, so quoting it is safe.
            await using var command = new NpgsqlCommand($"CREATE SCHEMA IF NOT EXISTS \"{schemaName}\"", connection);
            await command.ExecuteNonQueryAsync(ct);
        }

        // Every visitor schema that physically exists on the server.
        public async Task<List<string>> ListDemoDatabasesAsync(CancellationToken ct = default)
        {
            var names = new List<string>();
            await using var connection = new NpgsqlConnection(_mainConnectionString);
            await connection.OpenAsync(ct);
            // Backslash is PostgreSQL's default LIKE escape, so \_ matches a literal underscore.
            await using var command = new NpgsqlCommand(
                "SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'demo\\_%'", connection);
            await using var reader = await command.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
                names.Add(reader.GetString(0));
            return names.Where(IsValidName).ToList();
        }

        // Drops one visitor schema and everything in it. The name is checked against the strict
        // pattern first, so public (or any other schema) can never be dropped through this method.
        public async Task DropDatabaseAsync(string schemaName, CancellationToken ct = default)
        {
            if (!IsValidName(schemaName))
                throw new InvalidOperationException("Refusing to drop a schema that is not a demo schema.");

            // Release this app's pooled connections that target that schema first.
            NpgsqlConnection.ClearPool(new NpgsqlConnection(ConnectionStringFor(schemaName)));

            await using var connection = new NpgsqlConnection(_mainConnectionString);
            await connection.OpenAsync(ct);

            await using (var exists = new NpgsqlCommand(
                "SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name = @name", connection))
            {
                exists.Parameters.AddWithValue("name", schemaName);
                var count = Convert.ToInt32(await exists.ExecuteScalarAsync(ct));
                if (count == 0) return;
            }

            // The name has been validated above, so it is safe to place inside the quotes.
            // CASCADE removes the schema and everything in it in one statement.
            await using (var drop = new NpgsqlCommand($"DROP SCHEMA IF EXISTS \"{schemaName}\" CASCADE", connection))
            {
                await drop.ExecuteNonQueryAsync(ct);
            }

            // Nothing of that visitor stays behind: live connections close, its locks go.
            Backend.Live.LiveConnections.AbortDatabase(schemaName);
            Backend.Services.Locks.Forget(schemaName);
        }
    }
}
