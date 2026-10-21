using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;

namespace Backend.Data
{
    // Each visitor demo builds its tables in its own PostgreSQL schema, so the model differs per
    // schema (different default schema, DemoSessions left out). Without a schema aware cache key EF
    // would build the model once and reuse it for every visitor, putting them all in one schema.
    // Keying the cache by context type and schema gives each schema its own cached model.
    public sealed class DemoSchemaModelCacheKeyFactory : IModelCacheKeyFactory
    {
        public object Create(DbContext context, bool designTime)
            => (context.GetType(), (context as AppDbContext)?.Schema, designTime);
    }
}
