using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Backend.Auth
{
    // Restricts an endpoint to Admin users only (e.g. Users management, Control Unit).
    // These are super-admin areas that are never delegated through permissions.
    public class AdminOnlyAttribute : Attribute, IAuthorizationFilter
    {
        public void OnAuthorization(AuthorizationFilterContext context)
        {
            var user = context.HttpContext.User;
            var role = user.FindFirst(ClaimTypes.Role)?.Value
                       ?? user.FindFirst("role")?.Value;

            if (!string.Equals(role, "Admin", StringComparison.OrdinalIgnoreCase))
            {
                context.Result = new ObjectResult(new { message = "This area is restricted to administrators." })
                {
                    StatusCode = 403
                };
            }
        }
    }
}
