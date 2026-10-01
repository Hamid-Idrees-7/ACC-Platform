using Backend.Demo;
using Backend.Models.Entities;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace Backend.Auth
{
    // Creates the JWT a user gets after signing in.
    public class TokenService
    {
        private readonly IConfiguration _config;

        public TokenService(IConfiguration config)
        {
            _config = config;
        }

        // Normal sign-in token. loginId is the session (LoginActivity row) the token belongs to,
        // and the token expires together with that session.
        public string CreateToken(User user, int loginId, DateTime expiresAtUtc)
        {
            var claims = BuildClaims(user);
            claims.Add(new Claim(SessionClaims.LoginId, loginId.ToString()));
            return WriteToken(claims, DateTime.SpecifyKind(expiresAtUtc, DateTimeKind.Utc));
        }

        // Token for a demo visitor: the same identity claims, plus the visitor's session and
        // private database. It expires together with the demo session.
        public string CreateDemoToken(User user, int loginId, int sessionId, string databaseName, string demoRole, DateTime expiresAtUtc)
        {
            var claims = BuildClaims(user);
            claims.Add(new Claim(SessionClaims.LoginId, loginId.ToString()));
            claims.Add(new Claim(DemoClaims.SessionId, sessionId.ToString()));
            claims.Add(new Claim(DemoClaims.Database, databaseName));
            claims.Add(new Claim(DemoClaims.Role, demoRole));

            return WriteToken(claims, DateTime.SpecifyKind(expiresAtUtc, DateTimeKind.Utc));
        }

        // Identity claims shared by normal and demo tokens.
        private static List<Claim> BuildClaims(User user) => new()
        {
            new Claim(ClaimTypes.NameIdentifier, user.UserID.ToString()),
            new Claim(ClaimTypes.Name, user.Username),
            new Claim(ClaimTypes.Role, user.Role),
            new Claim("FullName", user.FullName)
        };

        private string WriteToken(List<Claim> claims, DateTime expiresUtc)
        {
            // The signing key comes from User Secrets.
            var jwtKey = _config["Jwt:Key"]!;
            var jwtIssuer = _config["Jwt:Issuer"];
            var jwtAudience = _config["Jwt:Audience"];

            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));
            var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            var token = new JwtSecurityToken(
                issuer: jwtIssuer,
                audience: jwtAudience,
                claims: claims,
                expires: expiresUtc,
                signingCredentials: credentials
            );

            return new JwtSecurityTokenHandler().WriteToken(token);
        }
    }
}
