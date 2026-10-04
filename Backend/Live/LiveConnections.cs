using System.Collections.Concurrent;
using System.Security.Claims;
using Backend.Auth;
using Backend.Demo;
using Microsoft.AspNetCore.SignalR;

namespace Backend.Live
{
    // The open live connections and the sign-in each one belongs to, so a connection can be
    // closed when its sign-in ends (signed out, password changed, account disabled, demo over)
    // instead of staying open until the browser goes away.
    public static class LiveConnections
    {
        public sealed record Entry(HubCallerContext Context, string? DemoDatabase, int UserId, int LoginId);

        private static readonly ConcurrentDictionary<string, Entry> Open = new();

        public static void Add(HubCallerContext context)
        {
            var user = context.User;
            if (!int.TryParse(user?.FindFirstValue(ClaimTypes.NameIdentifier), out var userId) ||
                !int.TryParse(user?.FindFirstValue(SessionClaims.LoginId), out var loginId))
            {
                context.Abort();
                return;
            }
            var demo = user?.FindFirst(DemoClaims.Database)?.Value;
            Open[context.ConnectionId] = new Entry(context, string.IsNullOrEmpty(demo) ? null : demo, userId, loginId);
        }

        public static void Remove(string connectionId) => Open.TryRemove(connectionId, out _);

        public static List<Entry> All() => Open.Values.ToList();

        // A demo database was dropped: every connection to it closes.
        public static void AbortDatabase(string demoDatabase)
        {
            foreach (var entry in Open.Values.Where(e => e.DemoDatabase == demoDatabase))
                entry.Context.Abort();
        }
    }
}
