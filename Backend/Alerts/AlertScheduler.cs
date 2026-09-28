using System.Collections.Concurrent;
using System.Threading.Channels;
using Backend.Demo;

namespace Backend.Alerts
{
    public class AlertScheduler
    {
        public const string MainDatabase = "main";

        private readonly Channel<string> _queue = Channel.CreateUnbounded<string>();
        private readonly ConcurrentDictionary<string, SemaphoreSlim> _locks = new();

        public ChannelReader<string> Queue => _queue.Reader;

        public void Request(string? demoDatabase)
        {
            if (demoDatabase != null && !DemoDbFactory.IsValidName(demoDatabase)) return;
            _queue.Writer.TryWrite(demoDatabase ?? MainDatabase);
        }

        public async Task<IDisposable> LockAsync(string databaseName, CancellationToken ct = default)
        {
            var gate = _locks.GetOrAdd(databaseName, _ => new SemaphoreSlim(1, 1));
            await gate.WaitAsync(ct);
            return new Release(gate);
        }

        private sealed class Release : IDisposable
        {
            private SemaphoreSlim? _gate;

            public Release(SemaphoreSlim gate) => _gate = gate;

            public void Dispose()
            {
                _gate?.Release();
                _gate = null;
            }
        }
    }
}
