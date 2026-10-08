using Backend.Ai;
using Backend.Auth;
using Backend.Models.DTOs;
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

        public AiController(IAiClient ai, IOptions<AiOptions> options, IWebHostEnvironment env)
        {
            _ai = ai;
            _options = options.Value;
            _env = env;
        }

        // GET: /api/ai/ping  = check the AI link works (Admin only).
        [HttpGet("ping")]
        [Authorize]
        [AdminOnly]
        public async Task<IActionResult> Ping(CancellationToken ct)
        {
            var reply = await _ai.ChatAsync(
                "You are a connection test for a construction management app. Reply in one short, friendly sentence.",
                Array.Empty<AiMessage>(),
                "Say hello and confirm the connection is working.",
                ct);

            if (!reply.Ok)
                return StatusCode(502, new { message = reply.Error });

            return Ok(new { provider = _ai.Provider, model = _ai.Model, reply = reply.Text });
        }

        // POST: /api/ai/chat  = the public website assistant (no sign-in needed).
        // Talk only for now: it answers from the company information, no database access.
        [HttpPost("chat")]
        [AllowAnonymous]
        [EnableRateLimiting(SecurityOptions.AiPublicRateLimitPolicy)]
        public async Task<IActionResult> Chat([FromBody] AiChatRequestDto dto, CancellationToken ct)
        {
            if (!_options.Enabled)
                return Ok(new { reply = "The assistant is turned off right now. Please use the contact form and our team will reply within 24 hours." });

            var message = (dto.Message ?? "").Trim();
            if (message.Length == 0)
                return BadRequest(new { message = "Please type a message." });

            // Keep only the last few turns, so the request stays small and cheap.
            var history = (dto.History ?? new List<AiChatTurnDto>())
                .TakeLast(10)
                .Select(t => new AiMessage(t.Role == "model" ? "model" : "user", (t.Text ?? "").Trim()))
                .Where(t => t.Text.Length > 0)
                .ToList();

            var reply = await _ai.ChatAsync(PublicAssistant.SystemPrompt, history, message, ct);
            if (!reply.Ok)
            {
                // In development, show the real reason so problems are easy to find.
                // In production, keep it friendly and generic.
                var detail = _env.IsDevelopment() && !string.IsNullOrEmpty(reply.Error) ? $" [{reply.Error}]" : "";
                return StatusCode(502, new { message = "The assistant is busy right now. Please try again in a moment." + detail });
            }

            return Ok(new { reply = reply.Text });
        }
    }
}
