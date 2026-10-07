using Backend.Ai;
using Backend.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Backend.Controllers
{
    // AI endpoints. Phase 0 is just a connection test, so it is Admin only and does nothing
    // more than send a short message to the provider and return the reply.
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class AiController : ControllerBase
    {
        private readonly IAiClient _ai;

        public AiController(IAiClient ai)
        {
            _ai = ai;
        }

        // GET: /api/ai/ping  = check the AI link works (Admin only).
        [HttpGet("ping")]
        [AdminOnly]
        public async Task<IActionResult> Ping(CancellationToken ct)
        {
            var reply = await _ai.SendAsync(
                "You are a connection test for a construction management app. Reply in one short, friendly sentence.",
                "Say hello and confirm the connection is working.",
                ct);

            if (!reply.Ok)
                return StatusCode(502, new { message = reply.Error });

            return Ok(new { provider = _ai.Provider, model = _ai.Model, reply = reply.Text });
        }
    }
}
