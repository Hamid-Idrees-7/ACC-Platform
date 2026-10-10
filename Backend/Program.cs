using System.Net;
using System.Security.Claims;
using System.Threading.RateLimiting;
using Backend.Alerts;
using Backend.Auth;
using Backend.Data;
using Backend.Demo;
using Backend.Email;
using Backend.Live;
using Backend.Repositories;
using Backend.Services;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.OpenApi;

var builder = WebApplication.CreateBuilder(args);

// "Today" for the whole app follows the company's time zone (App:TimeZone)
Backend.AppTime.Configure(builder.Configuration["App:TimeZone"]);

// No request needs more than this (the largest is a company logo of about 600 KB).
builder.WebHost.ConfigureKestrel(options => options.Limits.MaxRequestBodySize = 2 * 1024 * 1024);

// Behind a hosting proxy every request arrives from the proxy's address. When this is turned on
// (ForwardedHeaders:Enabled), the visitor's real address is read from the last X-Forwarded-For
// entry, which the proxy itself adds, so a header sent by the visitor can't fake it.
var forwarded = builder.Configuration.GetSection("ForwardedHeaders");
var useForwardedHeaders = forwarded.GetValue<bool>("Enabled");
if (useForwardedHeaders)
{
    builder.Services.Configure<ForwardedHeadersOptions>(options =>
    {
        options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
        options.ForwardLimit = 1;
        var proxies = forwarded.GetSection("KnownProxies").Get<string[]>() ?? Array.Empty<string>();
        if (proxies.Length > 0)
        {
            options.KnownProxies.Clear();
            foreach (var proxy in proxies) options.KnownProxies.Add(IPAddress.Parse(proxy));
        }
        else
        {
            // The host's proxy address isn't fixed: trust whichever proxy is in front of the app.
            options.KnownProxies.Clear();
#pragma warning disable CS0618, ASPDEPR005
            options.KnownNetworks.Clear();
#pragma warning restore CS0618, ASPDEPR005
        }
    });
}

builder.Services.AddControllers();

builder.Services.AddOpenApi();
builder.Services.AddEndpointsApiExplorer();

builder.Services.AddSwaggerGen();

// Visitor demo: every visitor gets a private database of their own (see Backend/Demo).
builder.Services.Configure<DemoOptions>(builder.Configuration.GetSection("Demo"));
builder.Services.AddHttpContextAccessor();
builder.Services.AddMemoryCache();
builder.Services.AddSingleton<DemoDbFactory>();
builder.Services.AddSingleton<DemoConnectionResolver>();
builder.Services.AddSingleton<DemoManager>();
builder.Services.AddSingleton<StartupWarmUp>();
builder.Services.AddHostedService(provider => provider.GetRequiredService<StartupWarmUp>());
builder.Services.AddHostedService<DemoPoolService>();

// Live connections close when the token runs out (MapHub below), and when the sign-in ends (LiveSessionSweeper).
builder.Services.AddSignalR();
builder.Services.AddHostedService<LiveSessionSweeper>();
builder.Services.AddSingleton<LiveChangeInterceptor>();
builder.Services.AddSingleton<LiveTransactionInterceptor>();
builder.Services.AddSingleton<AlertScheduler>();
builder.Services.AddHostedService<AlertWorker>();

// SQL Server. The connection is chosen per request: the main database normally, or the
// visitor's own database when the caller holds a demo token.
builder.Services.AddDbContext<AppDbContext>((serviceProvider, options) =>
    options.UseSqlServer(serviceProvider.GetRequiredService<DemoConnectionResolver>().GetConnectionString())
           .AddInterceptors(
               serviceProvider.GetRequiredService<LiveChangeInterceptor>(),
               serviceProvider.GetRequiredService<LiveTransactionInterceptor>()));

// Starting a demo is limited per IP address so nobody can script it to fill the server.
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    // Every signed-in user: far more than a person clicking around needs, too few for a script
    // looping on the API. A demo visitor gets less (their database shares the server).
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(httpContext =>
    {
        var userId = httpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (userId == null || httpContext.Request.Path.StartsWithSegments("/hubs"))
            return RateLimitPartition.GetNoLimiter("anonymous");

        var demo = httpContext.User.FindFirst(DemoClaims.Database)?.Value;
        return RateLimitPartition.GetSlidingWindowLimiter((demo ?? "main") + ":" + userId, _ => new SlidingWindowRateLimiterOptions
        {
            PermitLimit = demo != null ? SecurityOptions.DemoRequestsPerMinute : SecurityOptions.RequestsPerMinute,
            Window = TimeSpan.FromMinutes(1),
            SegmentsPerWindow = 6,
            QueueLimit = 0
        });
    });
    options.AddPolicy(DemoOptions.StartRateLimitPolicy, httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: ClientPartition.For(httpContext),
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 4,
                Window = TimeSpan.FromMinutes(15),
                QueueLimit = 0
            }));
    // Sign-in is limited per IP address across all usernames (password guessing on many
    // accounts at once). Wrong passwords for one username are paused separately (AuthService).
    options.AddPolicy(SecurityOptions.LoginRateLimitPolicy, httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: ClientPartition.For(httpContext),
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 30,
                Window = TimeSpan.FromMinutes(10),
                QueueLimit = 0
            }));
    // Forgot and reset password: enough for a person, too few to guess links or flood inboxes.
    options.AddPolicy(SecurityOptions.PasswordResetRateLimitPolicy, httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: ClientPartition.For(httpContext),
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 10,
                Window = TimeSpan.FromMinutes(15),
                QueueLimit = 0
            }));
    // Current password checks: per signed-in user (demo users are told apart by their database).
    options.AddPolicy(SecurityOptions.PasswordCheckRateLimitPolicy, httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: (httpContext.User.FindFirst(DemoClaims.Database)?.Value ?? "main") + ":" +
                          (httpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? ClientPartition.For(httpContext)),
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 10,
                Window = TimeSpan.FromMinutes(15),
                QueueLimit = 0
            }));
    // Public AI chat: enough for a real conversation, too few to run up a bill.
    options.AddPolicy(SecurityOptions.AiPublicRateLimitPolicy, httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: ClientPartition.For(httpContext),
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 20,
                Window = TimeSpan.FromMinutes(10),
                QueueLimit = 0
            }));
    // Website contact form: a few messages per visitor is plenty.
    options.AddPolicy(SecurityOptions.ContactFormRateLimitPolicy, httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: ClientPartition.For(httpContext),
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 5,
                Window = TimeSpan.FromMinutes(15),
                QueueLimit = 0
            }));
    options.OnRejected = async (context, cancellationToken) =>
    {
        var policy = context.HttpContext.GetEndpoint()?.Metadata.GetMetadata<EnableRateLimitingAttribute>()?.PolicyName;
        var message = policy switch
        {
            SecurityOptions.LoginRateLimitPolicy => "Too many sign-in attempts from your network. Please wait a few minutes and try again.",
            SecurityOptions.PasswordResetRateLimitPolicy => "Too many password reset attempts from your network. Please wait a few minutes and try again.",
            SecurityOptions.PasswordCheckRateLimitPolicy => "Too many password attempts. Please wait a few minutes and try again.",
            SecurityOptions.ContactFormRateLimitPolicy => "You have sent several messages already. Please wait a few minutes, or call us instead.",
            SecurityOptions.AiPublicRateLimitPolicy => "You've chatted a lot in a short time. Please wait a few minutes and try again.",
            DemoOptions.StartRateLimitPolicy => "Too many demo attempts from your network. Please wait a few minutes and try again.",
            _ => "You're going a bit fast. Please wait a moment and try again."
        };
        await context.HttpContext.Response.WriteAsJsonAsync(new { message }, cancellationToken);
    };
});

// Repositories and services, grouped by module (dependency injection)

// Project
builder.Services.AddScoped<IProjectRepository, ProjectRepository>();
builder.Services.AddScoped<IProjectService, ProjectService>();
// Assignment
builder.Services.AddScoped<IAssignmentRepository, AssignmentRepository>();
builder.Services.AddScoped<IAssignmentService, AssignmentService>();
// Attendance
builder.Services.AddScoped<IAttendanceRepository, AttendanceRepository>();
builder.Services.AddScoped<IAttendanceService, AttendanceService>();
// Salaries
builder.Services.AddScoped<ISalaryRepository, SalaryRepository>();
builder.Services.AddScoped<ISalaryService, SalaryService>();
// User display settings (Settings > Appearance)
builder.Services.AddScoped<IPreferenceRepository, PreferenceRepository>();
builder.Services.AddScoped<IPreferenceService, PreferenceService>();
// Company details, currency and invoice defaults (Settings > Company)
builder.Services.AddScoped<ICompanySettingsRepository, CompanySettingsRepository>();
builder.Services.AddScoped<ICompanySettingsService, CompanySettingsService>();
// Weekly off days and holidays (Settings > Calendar)
builder.Services.AddScoped<ICalendarRepository, CalendarRepository>();
builder.Services.AddScoped<ICalendarService, CalendarService>();
// Project expenses (plot, transfer, taxes, possession). They feed project cost and billing.
builder.Services.AddScoped<IProjectExpenseRepository, ProjectExpenseRepository>();
builder.Services.AddScoped<IProjectExpenseService, ProjectExpenseService>();
// Billing
builder.Services.AddScoped<IBillingRepository, BillingRepository>();
builder.Services.AddScoped<IBillingService, BillingService>();
// Reports read from the other modules, so no repository of its own
builder.Services.AddScoped<IReportsService, ReportsService>();
// Field view for site engineers. Reuses the project and attendance services, no repository.
builder.Services.AddScoped<IFieldService, FieldService>();
// Material requests (field request, then approval, then issue)
builder.Services.AddScoped<IMaterialRequestRepository, MaterialRequestRepository>();
builder.Services.AddScoped<IMaterialRequestService, MaterialRequestService>();
// Material
builder.Services.AddScoped<IMaterialRepository, MaterialRepository>();
builder.Services.AddScoped<IMaterialService, MaterialService>();
// Notifications
builder.Services.AddScoped<INotificationRepository, NotificationRepository>();
builder.Services.AddScoped<INotificationService, NotificationService>();
// Approvals
builder.Services.AddScoped<IPendingActionRepository, PendingActionRepository>();
builder.Services.AddScoped<IPendingActionService, PendingActionService>();
// Permissions
builder.Services.AddScoped<IPermissionRepository, PermissionRepository>();
builder.Services.AddScoped<IPermissionService, PermissionService>();
// User
builder.Services.AddScoped<IUserRepository, UserRepository>();
builder.Services.AddScoped<IUserService, UserService>();
// Employee
builder.Services.AddScoped<IEmployeeRepository, EmployeeRepository>();
builder.Services.AddScoped<IEmployeeService, EmployeeService>();
// Client
builder.Services.AddScoped<IClientRepository, ClientRepository>();
builder.Services.AddScoped<IClientService, ClientService>();
// Inquiry
builder.Services.AddScoped<IInquiryRepository, InquiryRepository>();
builder.Services.AddScoped<IAiConversationRepository, AiConversationRepository>();
builder.Services.AddScoped<IInquiryService, InquiryService>();
// My Profile
builder.Services.AddScoped<IProfileService, ProfileService>();
// Sign-in history and sessions (Settings > Security)
builder.Services.AddScoped<ILoginActivityRepository, LoginActivityRepository>();
builder.Services.AddScoped<ISessionService, SessionService>();
// Alerts
builder.Services.AddScoped<IAlertRepository, AlertRepository>();
builder.Services.AddScoped<IAlertService, AlertService>();
builder.Services.AddScoped<IAlertCheckService, AlertCheckService>();
// Auth
builder.Services.AddScoped<Backend.Auth.TokenService>();
builder.Services.AddScoped<IAuthService, AuthService>();
// AI assistant (Settings "Ai"). Provider is chosen here, so the rest of the app depends only
// on IAiClient and never on a specific provider. The key comes from User Secrets, never the repo.
builder.Services.Configure<Backend.Ai.AiOptions>(builder.Configuration.GetSection("Ai"));
builder.Services.AddHttpClient("ai", client => client.Timeout = TimeSpan.FromSeconds(30));
var aiProvider = builder.Configuration["Ai:Provider"] ?? "gemini";
if (string.Equals(aiProvider, "gemini", StringComparison.OrdinalIgnoreCase))
    builder.Services.AddSingleton<Backend.Ai.IAiClient, Backend.Ai.GeminiClient>();
else
    throw new InvalidOperationException($"Unknown Ai:Provider '{aiProvider}'. Supported: gemini.");

// Forgot password (email link)
builder.Services.Configure<EmailOptions>(builder.Configuration.GetSection("Email"));
builder.Services.AddSingleton<IEmailSender, SmtpEmailSender>();
builder.Services.AddScoped<IPasswordResetRepository, PasswordResetRepository>();
builder.Services.AddScoped<IPasswordResetService, PasswordResetService>();

// JWT authentication. The signing key comes from User Secrets or the host's settings, never
// the repository; the app refuses to start without a strong one.
var jwtKey = System.Text.Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"] ?? "");
if (jwtKey.Length < 32)
    throw new InvalidOperationException("Jwt:Key is missing or too short. Set a random key of at least 32 characters in User Secrets (development) or the host's environment settings.");

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new Microsoft.IdentityModel.Tokens.TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = builder.Configuration["Jwt:Issuer"],
        ValidAudience = builder.Configuration["Jwt:Audience"],
        IssuerSigningKey = new Microsoft.IdentityModel.Tokens.SymmetricSecurityKey(jwtKey)
    };
    options.Events = new Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerEvents
    {
        OnMessageReceived = context =>
        {
            var token = context.Request.Query["access_token"];
            if (!string.IsNullOrEmpty(token) && context.HttpContext.Request.Path.StartsWithSegments("/hubs"))
                context.Token = token;
            return Task.CompletedTask;
        }
    };
});

// Let the website (App:FrontendUrl, eg http://localhost:5173 in development) call this API
var frontendOrigins = (builder.Configuration["App:FrontendUrl"] ?? "http://localhost:5173")
    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
    .Select(url => url.TrimEnd('/'))
    .ToArray();
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins(frontendOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

var app = builder.Build();

// Request pipeline
if (useForwardedHeaders)
    app.UseForwardedHeaders();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.UseSwagger();
    app.UseSwaggerUI();
}
else
{
    // An unexpected error is logged on the server; the browser only gets a plain message.
    app.UseExceptionHandler(error => error.Run(async context =>
    {
        context.Response.StatusCode = StatusCodes.Status500InternalServerError;
        await context.Response.WriteAsJsonAsync(new { message = "Something went wrong. Please try again." });
    }));
    app.UseHsts();
}

app.UseHttpsRedirection();

app.UseCors("AllowFrontend");

app.UseAuthentication();

// Stops requests from demo tokens whose session has ended (right after the token is read).
app.UseMiddleware<DemoSessionMiddleware>();

// Stops requests from tokens whose session has ended (signed out, password changed, disabled...).
app.UseMiddleware<SessionGuardMiddleware>();

app.UseRateLimiter();

app.UseAuthorization();

app.MapControllers();
app.MapGet("/api/health", () => Results.Ok(new { status = "ok" }));
app.MapHub<LiveHub>("/hubs/live", options => options.CloseOnAuthenticationExpiration = true);

app.Run();