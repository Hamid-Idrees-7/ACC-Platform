namespace Backend.Demo
{
    // Runs right after authentication. If the caller carries a demo token, the session behind it
    // must still be active; otherwise the request is stopped with a clear "demo_expired" answer
    // (the frontend then signs the visitor out). Normal users are not affected at all.
    public class DemoSessionMiddleware
    {
        private readonly RequestDelegate _next;

        public DemoSessionMiddleware(RequestDelegate next)
        {
            _next = next;
        }

        public async Task InvokeAsync(HttpContext context, DemoManager manager)
        {
            var sessionClaim = context.User.FindFirst(DemoClaims.SessionId)?.Value;

            // Endpoints pinned to the main database (sign-in, public contact form, starting a demo)
            // must keep working even when the browser still holds an old demo token.
            var pinnedToMain = context.GetEndpoint()?.Metadata.GetMetadata<UseMainDatabaseAttribute>() != null;

            if (sessionClaim != null && !pinnedToMain)
            {
                var database = context.User.FindFirst(DemoClaims.Database)?.Value;
                var active = int.TryParse(sessionClaim, out var sessionId) &&
                             database != null &&
                             await manager.IsActiveAsync(sessionId, database, context.RequestAborted);

                if (!active)
                {
                    context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                    await context.Response.WriteAsJsonAsync(new
                    {
                        code = "demo_expired",
                        message = "Your demo session has ended."
                    });
                    return;
                }
            }

            await _next(context);
        }
    }
}
