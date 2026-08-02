using Backend.Models.Entities;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace Backend.Auth
{
    // Creates JWT tokens for users after successful login.
    public class TokenService
    {
        private readonly IConfiguration _config;

        // IConfiguration lets us read settings (like the JWT key) from configuration
        public TokenService(IConfiguration config)
        {
            _config = config;
        }

        // Builds a signed JWT token for the given user
        public string CreateToken(User user)
        {
            // Read JWT settings from configuration (key comes from User Secrets)
            var jwtKey = _config["Jwt:Key"]!;
            var jwtIssuer = _config["Jwt:Issuer"];
            var jwtAudience = _config["Jwt:Audience"];
            var expiryMinutes = double.Parse(_config["Jwt:ExpiryMinutes"]!);

            // "Claims" are pieces of info stored inside the token (who this user is)
            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.NameIdentifier, user.UserID.ToString()),
                new Claim(ClaimTypes.Name, user.Username),
                new Claim(ClaimTypes.Role, user.Role),
                new Claim("FullName", user.FullName)
            };

            // Create the signing key and credentials using our secret key (the "stamp")
            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));
            var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            // Build the token with claims, expiry, issuer, audience and the signature
            var token = new JwtSecurityToken(
                issuer: jwtIssuer,
                audience: jwtAudience,
                claims: claims,
                expires: DateTime.Now.AddMinutes(expiryMinutes),
                signingCredentials: credentials
            );

            // Convert the token object into a string that can be sent to the client
            return new JwtSecurityTokenHandler().WriteToken(token);
        }
    }
}