using System.Collections.Concurrent;

namespace Backend.Services
{
    // Named locks for work that reads a total and then saves based on it (stock levels, the next
    // invoice number, what is still due on an invoice or a salary). Two such changes for the same thing never
    // run at the same time, so the check and the save always see each other.
    // Keys include the database name, so demo databases never wait on each other.
    public static class Locks
    {
        private static readonly ConcurrentDictionary<string, SemaphoreSlim> Gates = new();

        public static Task<IDisposable> ForStockAsync(string database, int materialId) =>
            AcquireAsync($"{database}:stock:{materialId}");

        public static Task<IDisposable> ForInvoiceNumberAsync(string database) =>
            AcquireAsync($"{database}:invoice-number");

        public static Task<IDisposable> ForInvoiceAsync(string database, int invoiceId) =>
            AcquireAsync($"{database}:invoice:{invoiceId}");

        public static Task<IDisposable> ForSalaryAsync(string database, int employeeId) =>
            AcquireAsync($"{database}:salary:{employeeId}");

        // Saves that check a list for duplicates first (eg the same CNIC, an employee linked to two
        // logins), so two saves at the same moment can't both pass the check.
        public static Task<IDisposable> ForRecordsAsync(string database, string kind) =>
            AcquireAsync($"{database}:records:{kind}");

        // A demo database was dropped: its locks are no longer needed.
        public static void Forget(string database)
        {
            foreach (var key in Gates.Keys.Where(k => k.StartsWith(database + ":", StringComparison.Ordinal)))
                Gates.TryRemove(key, out _);
        }

        private static async Task<IDisposable> AcquireAsync(string key)
        {
            var gate = Gates.GetOrAdd(key, _ => new SemaphoreSlim(1, 1));
            await gate.WaitAsync();
            return new Release(gate);
        }

        private sealed class Release : IDisposable
        {
            private SemaphoreSlim? _gate;
            public Release(SemaphoreSlim gate) => _gate = gate;
            public void Dispose() => Interlocked.Exchange(ref _gate, null)?.Release();
        }
    }
}
