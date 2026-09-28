using System.Security.Claims;
using Backend.Demo;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace Backend.Live
{
    [Authorize]
    public class LiveHub : Hub
    {
        public override async Task OnConnectedAsync()
        {
            var database = LiveGroups.DatabaseKey(Context.User);
            await Groups.AddToGroupAsync(Context.ConnectionId, LiveGroups.Database(database));

            if (int.TryParse(Context.User?.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
                await Groups.AddToGroupAsync(Context.ConnectionId, LiveGroups.User(database, userId));

            await base.OnConnectedAsync();
        }
    }

    public static class LiveGroups
    {
        public static string DatabaseKey(ClaimsPrincipal? user) =>
            user?.FindFirst(DemoClaims.Database)?.Value is { Length: > 0 } demo ? $"demo:{demo}" : "main";

        public static string ForDatabase(string? databaseName) =>
            DemoDbFactory.IsValidName(databaseName) ? $"demo:{databaseName}" : "main";

        public static string Database(string databaseKey) => $"db:{databaseKey}";

        public static string User(string databaseKey, int userId) => $"user:{databaseKey}:{userId}";
    }
}
