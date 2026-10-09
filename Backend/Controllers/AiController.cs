using System.Text.Json;
using Backend.Ai;
using Backend.Auth;
using Backend.Demo;
using Backend.Models.DTOs;
using Backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;

namespace Backend.Controllers
{
    // AI endpoints.
    [ApiController]
    [Route("api/[controller]")]
    public class AiController : ControllerBase
    {
        private readonly IAiClient _ai;
        private readonly AiOptions _options;
        private readonly IWebHostEnvironment _env;
        private readonly IInquiryService _inquiries;
        private readonly INotificationService _notifications;

        public AiController(IAiClient ai, IOptions<AiOptions> options, IWebHostEnvironment env,
            IInquiryService inquiries, INotificationService notifications)
        {
            _ai = ai;
            _options = options.Value;
            _env = env;
            _inquiries = inquiries;
            _notifications = notifications;
        }

        // GET: /api/ai/ping  = check the AI link works (Admin only).
        [HttpGet("ping")]
        [Authorize]
        [AdminOnly]
        public async Task<IActionResult> Ping(CancellationToken ct)
        {
            var reply = await _ai.ChatAsync(
                "You are a connection test for a construction management app. Reply in one short, friendly sentence.",
                Array.Empty<AiMessage>(), "Say hello and confirm the connection is working.",
                Array.Empty<AiTool>(), ct);

            if (!reply.Ok)
                return StatusCode(502, new { message = reply.Error });

            return Ok(new { provider = _ai.Provider, model = _ai.Model, reply = reply.Text });
        }

        // POST: /api/ai/chat  = the public website assistant (no sign-in needed).
        // It can work out a rough cost (our code, not the AI) and save a website inquiry.
        [HttpPost("chat")]
        [AllowAnonymous]
        [UseMainDatabase]
        [EnableRateLimiting(SecurityOptions.AiPublicRateLimitPolicy)]
        public async Task<IActionResult> Chat([FromBody] AiChatRequestDto dto, CancellationToken ct)
        {
            if (!_options.Enabled)
                return Ok(new { reply = "The assistant is turned off right now. Please use the contact form and our team will reply within 24 hours." });

            var message = (dto.Message ?? "").Trim();
            if (message.Length == 0)
                return BadRequest(new { message = "Please type a message." });

            var history = (dto.History ?? new List<AiChatTurnDto>())
                .TakeLast(10)
                .Select(t => new AiMessage(t.Role == "model" ? "model" : "user", (t.Text ?? "").Trim()))
                .Where(t => t.Text.Length > 0)
                .ToList();

            var reply = await _ai.ChatAsync(PublicAssistant.SystemPrompt, history, message, PublicTools(), ct);
            if (!reply.Ok)
            {
                var detail = _env.IsDevelopment() && !string.IsNullOrEmpty(reply.Error) ? $" [{reply.Error}]" : "";
                return StatusCode(502, new { message = "The assistant is busy right now. Please try again in a moment." + detail });
            }

            return Ok(new { reply = reply.Text });
        }

        // The tools the public assistant may use.
        private AiTool[] PublicTools() => new[]
        {
            new AiTool(
                "estimate_cost",
                "Give a rough construction cost estimate for a building. Use this whenever the visitor asks what something would cost to build.",
                new
                {
                    type = "object",
                    properties = new
                    {
                        area_marla = new { type = "number", description = "Plot size in marla" },
                        storeys = new { type = "integer", description = "Number of storeys / floors, eg 1, 2 or 3" },
                        finish = new { type = "string", @enum = new[] { "grey", "standard", "luxury" }, description = "Finish level" }
                    },
                    required = new[] { "area_marla" }
                },
                (args, _) => Task.FromResult<object>(CostEstimator.Estimate(
                    Num(args, "area_marla", 5), (int)Num(args, "storeys", 1), Str(args, "finish", "standard")))),

            new AiTool(
                "create_inquiry",
                "Save the visitor's message so the team can reply. Only call this after the visitor has given their name and phone number and confirmed they want to be contacted.",
                new
                {
                    type = "object",
                    properties = new
                    {
                        name = new { type = "string", description = "Visitor's name" },
                        phone = new { type = "string", description = "Visitor's phone number" },
                        email = new { type = "string", description = "Visitor's email, if given" },
                        service = new { type = "string", description = "Service they are interested in, if clear" },
                        message = new { type = "string", description = "Their message or requirement" }
                    },
                    required = new[] { "name", "phone", "message" }
                },
                CreateInquiryAsync)
        };

        private async Task<object> CreateInquiryAsync(JsonElement args, CancellationToken ct)
        {
            var dto = new CreateInquiryDto
            {
                Name = Str(args, "name", ""),
                Phone = Str(args, "phone", ""),
                Email = StrOrNull(args, "email"),
                Service = StrOrNull(args, "service"),
                Message = Str(args, "message", "")
            };

            var (success, message) = await _inquiries.SubmitInquiryAsync(dto);
            if (!success)
                return new { success = false, message };

            var about = string.IsNullOrWhiteSpace(dto.Service) ? "" : $" about {dto.Service.Trim()}";
            await _notifications.NotifyPermissionHoldersAsync(
                "Messages", "View", NotificationCategories.Message, "New website message",
                $"{dto.Name.Trim()} sent a message from the website{about}.",
                link: NotificationLinks.Messages);

            return new { success = true, message = "Saved. The team will reply within 24 hours." };
        }

        // Small readers for tool arguments (the AI sends them as JSON).
        private static double Num(JsonElement args, string name, double fallback) =>
            args.ValueKind == JsonValueKind.Object && args.TryGetProperty(name, out var v)
                ? (v.ValueKind == JsonValueKind.Number ? v.GetDouble()
                   : double.TryParse(v.GetString(), out var d) ? d : fallback)
                : fallback;

        private static string Str(JsonElement args, string name, string fallback) =>
            args.ValueKind == JsonValueKind.Object && args.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String
                ? (v.GetString() ?? fallback) : fallback;

        private static string? StrOrNull(JsonElement args, string name)
        {
            var s = Str(args, name, "");
            return string.IsNullOrWhiteSpace(s) ? null : s;
        }
    }
}
