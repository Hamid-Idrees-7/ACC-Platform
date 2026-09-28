namespace Backend.Demo
{
    public static class DatabaseScope
    {
        private static readonly AsyncLocal<string?> Current = new();

        public static string? DemoDatabase => Current.Value;

        public static IDisposable Use(string? demoDatabase)
        {
            var previous = Current.Value;
            Current.Value = demoDatabase;
            return new Restore(previous);
        }

        private sealed class Restore : IDisposable
        {
            private readonly string? _previous;
            private bool _done;

            public Restore(string? previous) => _previous = previous;

            public void Dispose()
            {
                if (_done) return;
                Current.Value = _previous;
                _done = true;
            }
        }
    }
}
