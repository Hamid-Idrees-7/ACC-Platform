using System.Security.Claims;
using Backend.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Backend.Auth
{
    // Checks that the logged-in user has permission for a specific module + action.
    // Admin always passes. Otherwise the permission must be explicitly allowed.
    public class RequirePermissionAttribute : Attribute, IAsyncActionFilter
    {
        private readonly string _module;
        private readonly string _action;

        public RequirePermissionAttribute(string module, string action)
        {
            _module = module;
            _action = action;
        }

        public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
        {
            var user = context.HttpContext.User;

            // Get the user's ID and role from the JWT token
            var idClaim = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            var role = user.FindFirst(ClaimTypes.Role)?.Value
                       ?? user.FindFirst("role")?.Value;

            if (!int.TryParse(idClaim, out var userId))
            {
                context.Result = new UnauthorizedResult();
                return;
            }

            // Admin always has full access
            if (string.Equals(role, "Admin", StringComparison.OrdinalIgnoreCase))
            {
                await next();
                return;
            }

            // Otherwise, check the permission from the database
            var permissionService = context.HttpContext.RequestServices
                .GetService(typeof(IPermissionService)) as IPermissionService;

            if (permissionService == null)
            {
                context.Result = new StatusCodeResult(500);
                return;
            }

            var allowed = await permissionService.HasPermissionAsync(userId, _module, _action);
            if (!allowed)
            {
                // 403 - logged in, but not allowed this action
                context.Result = new ObjectResult(new { message = "You don't have permission for this action." })
                {
                    StatusCode = 403
                };
                return;
            }

            await next();
        }
    }
}