namespace Backend.Demo
{
    // Decides which database the current request talks to.
    //   - Normal users (and anonymous requests) use the main database.
    //   - A visitor's signed demo token routes every query to that visitor's own database.
    // The business modules never need to know this happens: they keep using AppDbContext as before.
    public class DemoConnectionResolver
    {
        private readonly IHttpContextAccessor _http;
        private readonly DemoDbFactory _factory;

        public DemoConnectionResolver(IHttpContextAccessor http, DemoDbFactory factory)
        {
            _http = http;
            _factory = factory;
        }

        public string GetConnectionString()
        {
            var context = _http.HttpContext;

            // Background work (no request) always uses the main database.
            if (context == null)
                return _factory.MainConnectionString;

            // Endpoints such as the public contact form and the normal sign-in always use the
            // real database, even if the browser still holds a demo token.
            if (context.GetEndpoint()?.Metadata.GetMetadata<UseMainDatabaseAttribute>() != null)
                return _factory.MainConnectionString;

            var demoDatabase = context.User.FindFirst(DemoClaims.Database)?.Value;
            if (demoDatabase == null)
                return _factory.MainConnectionString;

            // A demo token must NEVER fall back to the main database: stop the request instead.
            if (context.User.Identity?.IsAuthenticated != true || !DemoDbFactory.IsValidName(demoDatabase))
                throw new UnauthorizedAccessException("Invalid demo session.");

            return _factory.ConnectionStringFor(demoDatabase);
        }
    }
}
