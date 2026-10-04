using Microsoft.EntityFrameworkCore.Storage;

namespace Backend.Data
{
    // Starts a transaction for work that saves more than once and must not stop halfway.
    // If one is already open on this context, null is returned and the outer one covers the work.
    public static class DbTransactions
    {
        public static async Task<IDbContextTransaction?> BeginOwnTransactionAsync(this AppDbContext context) =>
            context.Database.CurrentTransaction != null ? null : await context.Database.BeginTransactionAsync();
    }
}
