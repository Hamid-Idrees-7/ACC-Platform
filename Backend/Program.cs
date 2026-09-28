using System.Threading.RateLimiting;
using Backend.Alerts;
using Backend.Auth;
using Backend.Data;
using Backend.Demo;
using Backend.Live;
using Backend.Repositories;
using Backend.Services;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.OpenApi;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers();

// OpenAPI / Swagger
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
builder.Services.AddHostedService<DemoPoolService>();

// Register the database context (SQL Server). The connection is chosen per request:
// the main database normally, or the visitor's own database when the caller holds a demo token.
builder.Services.AddSignalR();
builder.Services.AddSingleton<LiveChangeInterceptor>();
builder.Services.AddSingleton<AlertScheduler>();
builder.Services.AddHostedService<AlertWorker>();

builder.Services.AddDbContext<AppDbContext>((serviceProvider, options) =>
    options.UseSqlServer(serviceProvider.GetRequiredService<DemoConnectionResolver>().GetConnectionString())
           .AddInterceptors(serviceProvider.GetRequiredService<LiveChangeInterceptor>()));

// Starting a demo is limited per IP address so nobody can script it to fill the server.
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy(DemoOptions.StartRateLimitPolicy, httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 6,
                Window = TimeSpan.FromMinutes(15),
                QueueLimit = 0
            }));
    // Sign-in is limited per IP address across all usernames (password guessing on many
    // accounts at once). Wrong passwords for one username are paused separately (AuthService).
    options.AddPolicy(SecurityOptions.LoginRateLimitPolicy, httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 30,
                Window = TimeSpan.FromMinutes(10),
                QueueLimit = 0
            }));
    options.OnRejected = async (context, cancellationToken) =>
    {
        var policy = context.HttpContext.GetEndpoint()?.Metadata.GetMetadata<EnableRateLimitingAttribute>()?.PolicyName;
        var message = policy == SecurityOptions.LoginRateLimitPolicy
            ? "Too many sign-in attempts from your network. Please wait a few minutes and try again."
            : "Too many demo attempts from your network. Please wait a few minutes and try again.";
        await context.HttpContext.Response.WriteAsJsonAsync(new { message }, cancellationToken);
    };
});

// Register our N-tier services (Dependency Injection)

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
// Project Expenses (plot, transfer, taxes, possession — feeds project cost and billing)
builder.Services.AddScoped<IProjectExpenseRepository, ProjectExpenseRepository>();
builder.Services.AddScoped<IProjectExpenseService, ProjectExpenseService>();
// Billing
builder.Services.AddScoped<IBillingRepository, BillingRepository>();
builder.Services.AddScoped<IBillingService, BillingService>();
// Reports (aggregates the other modules — no repository of its own)
builder.Services.AddScoped<IReportsService, ReportsService>();
// Field View (site-engineer scoped — reuses project/attendance services, no repository)
builder.Services.AddScoped<IFieldService, FieldService>();
// Material Requests (field to approval to issue)
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

// JWT Authentication setup
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
        IssuerSigningKey = new Microsoft.IdentityModel.Tokens.SymmetricSecurityKey(
            System.Text.Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"]!))
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

// Allow the React frontend (localhost:5173) to call this API
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins("http://localhost:5173")
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

app.UseCors("AllowFrontend");   // And we added this line with the local host's permission

app.UseAuthentication();

// Stops requests from demo tokens whose session has ended (right after the token is read).
app.UseMiddleware<DemoSessionMiddleware>();

// Stops requests from tokens whose session has ended (signed out, password changed, disabled...).
app.UseMiddleware<SessionGuardMiddleware>();

app.UseRateLimiter();

app.UseAuthorization();

app.MapControllers();
app.MapHub<LiveHub>("/hubs/live");

app.Run();