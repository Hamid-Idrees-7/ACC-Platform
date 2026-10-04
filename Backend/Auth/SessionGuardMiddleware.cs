using System.Security.Claims;
using Backend.Demo;
using Backend.Services;
using Microsoft.AspNetCore.Authorization;

namespace Backend.Auth
{
    // Runs right after authentication, on every request that carries a token. A signed token
    // alone is not enough: the session behind it must still be open. That is what makes
    // "Sign out", "Sign out all other devices", a password change or a disabled account take
    // effect at once instead of when the token expires.
    // The answer is a 401 with code "session_ended" and a message the sign-in page can show.
    public class SessionGuardMiddleware
    {
        private readonly RequestDelegate _next;

        public SessionGuardMiddleware(RequestDelegate next)
        {
            _next = next;
        }

        public async Task InvokeAsync(HttpContext context, ISessionService sessions)
        {
            var endpoint = context.GetEndpoint();
            var mainOnly = endpoint?.Metadata.GetMetadata<UseMainDatabaseAttribute>() != null;
            var needsSignIn = endpoint?.Metadata.GetMetadata<IAuthorizeData>() != null &&
                              endpoint.Metadata.GetMetadata<IAllowAnonymous>() == null;

            // A signed-in endpoint pinned to the main database never takes a demo token.
            if (mainOnly && needsSignIn && context.User.FindFirst(DemoClaims.Database) != null)
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                await context.Response.WriteAsJsonAsync(new { message = "This isn't available in the demo." });
                return;
            }

            // Public endpoints pinned to the main database (sign-in, contact form, demo start)
            // work with any token the browser still holds; everything else checks the session.
            var skip = context.User.Identity?.IsAuthenticated != true ||
                       (mainOnly && !needsSignIn) ||
                       endpoint?.Metadata.GetMetadata<SkipSessionCheckAttribute>() != null;

            if (!skip)
            {
                var userClaim = context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                var loginClaim = context.User.FindFirst(SessionClaims.LoginId)?.Value;

                var check = int.TryParse(userClaim, out var userId) && int.TryParse(loginClaim, out var loginId)
                    ? await sessions.CheckAsync(loginId, userId)
                    // A token from before sessions existed: sign in again once.
                    : SessionCheck.Ended(SessionCheck.Missing);

                if (!check.Active)
                {
                    context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                    await context.Response.WriteAsJsonAsync(new
                    {
                        code = "session_ended",
                        reason = check.Reason,
                        message = SessionCheck.MessageFor(check.Reason)
                    });
                    return;
                }
            }

            await _next(context);
        }
    }
}
