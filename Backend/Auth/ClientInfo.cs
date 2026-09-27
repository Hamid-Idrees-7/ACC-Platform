namespace Backend.Auth
{
    // Where a sign-in comes from: the IP address and the browser (user agent).
    public record ClientInfo(string? IpAddress, string? UserAgent)
    {
        public static ClientInfo From(HttpContext context)
        {
            var ip = context.Connection.RemoteIpAddress;
            if (ip != null && ip.IsIPv4MappedToIPv6) ip = ip.MapToIPv4();

            var agent = context.Request.Headers.UserAgent.ToString().Trim();
            if (agent.Length > 300) agent = agent[..300];

            return new ClientInfo(ip?.ToString(), agent.Length == 0 ? null : agent);
        }
    }

    // Claim names added to every token by TokenService.
    public static class SessionClaims
    {
        // The LoginActivity row behind the token (one per sign-in), checked on every request.
        public const string LoginId = "login_id";
    }
}
