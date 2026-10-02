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

    public static class ClientPartition
    {
        // The key rate limits group requests by: the IPv4 address, or the /64 network of an
        // IPv6 address (one home or server usually owns a whole /64).
        public static string For(HttpContext context) => For(context.Connection.RemoteIpAddress);

        public static string For(string? ipAddress) =>
            For(System.Net.IPAddress.TryParse(ipAddress, out var ip) ? ip : null);

        public static string For(System.Net.IPAddress? ip)
        {
            if (ip == null) return "unknown";
            if (ip.IsIPv4MappedToIPv6) ip = ip.MapToIPv4();
            if (ip.AddressFamily != System.Net.Sockets.AddressFamily.InterNetworkV6) return ip.ToString();

            var bytes = ip.GetAddressBytes();
            return Convert.ToHexString(bytes, 0, 8) + "::/64";
        }
    }

    // Claim names added to every token by TokenService.
    public static class SessionClaims
    {
        // The LoginActivity row behind the token (one per sign-in), checked on every request.
        public const string LoginId = "login_id";
    }
}
