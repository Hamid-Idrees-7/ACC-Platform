using System.Security.Claims;
using Backend.Auth;
using Backend.Models.DTOs;
using Backend.Repositories;
using Backend.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;

namespace Backend.Controllers
{
    // API endpoints for clients. Base route: /api/clients
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class ClientsController : ControllerBase
    {
        private readonly IClientService _service;
        private readonly IPermissionService _permissionService;
        private readonly IPendingActionService _approvalService;
        private readonly INotificationService _notificationService;
        private readonly IProjectRepository _projectRepository;

        public ClientsController(
            IClientService service,
            IPermissionService permissionService,
            IPendingActionService approvalService,
            INotificationService notificationService,
            IProjectRepository projectRepository)
        {
            _service = service;
            _permissionService = permissionService;
            _approvalService = approvalService;
            _notificationService = notificationService;
            _projectRepository = projectRepository;
        }

        private int GetUserId()
        {
            var idClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return int.TryParse(idClaim, out var id) ? id : 0;
        }

        private string GetUserName() =>
            User.FindFirst("FullName")?.Value ?? User.FindFirst(ClaimTypes.Name)?.Value ?? "";

        private string GetUserRole() =>
            User.FindFirst(ClaimTypes.Role)?.Value ?? "";

        private bool IsAdmin() =>
            string.Equals(GetUserRole(), "Admin", StringComparison.OrdinalIgnoreCase);

        // GET: /api/clients  = all clients
        [HttpGet]
        [RequirePermission("Clients", "View")]
        public async Task<IActionResult> GetAll()
        {
            var clients = await _service.GetAllClientsAsync();
            return Ok(clients);
        }

        // GET: /api/clients/5  = one client
        [HttpGet("{id}")]
        [RequirePermission("Clients", "View")]
        public async Task<IActionResult> GetById(int id)
        {
            var client = await _service.GetClientByIdAsync(id);
            if (client == null)
                return NotFound(new { message = "Client not found" });

            return Ok(client);
        }

        // POST: /api/clients  = create a client
        [HttpPost]
        [RequirePermission("Clients", "Add")]
        public async Task<IActionResult> Create([FromBody] ClientDto dto)
        {
            var client = await _service.CreateClientAsync(dto);

            // Tell the user who added it, and post it to the admins' activity feed.
            await _notificationService.NotifyPersonalAsync(
                GetUserId(), "Client", "Client added", $"You added client: {client.FullName}.",
                link: NotificationLinks.Client(client.ClientID));
            await _notificationService.NotifyAdminsActivityAsync(
                "Client", "New client", $"{GetUserName()} added client: {client.FullName}.",
                link: NotificationLinks.Client(client.ClientID));

            return CreatedAtAction(nameof(GetById), new { id = client.ClientID }, client);
        }

        // PUT: /api/clients/5  = update a client (also enable/disable)
        [HttpPut("{id}")]
        [RequirePermission("Clients", "Edit")]
        public async Task<IActionResult> Update(int id, [FromBody] ClientDto dto)
        {
            var client = await _service.UpdateClientAsync(id, dto);
            if (client == null)
                return NotFound(new { message = "Client not found" });

            return Ok(client);
        }

        // DELETE: /api/clients/5  = delete, or ask for approval when required
        [HttpDelete("{id}")]
        [RequirePermission("Clients", "Delete")]
        public async Task<IActionResult> Delete(int id)
        {
            var client = await _service.GetClientByIdAsync(id);
            if (client == null)
                return NotFound(new { message = "Client not found" });

            // A client with projects can't be deleted.
            if (await _projectRepository.AnyForClientAsync(id))
                return BadRequest(new { message = "This client has projects and can't be deleted. Reassign or remove those projects first, or set the client Inactive." });

            // Non-admins may need approval before the delete runs.
            if (!IsAdmin() && await _permissionService.RequiresApprovalAsync(GetUserId(), "Clients", "Delete"))
            {
                var created = await _approvalService.CreateAsync(
                    new CreatePendingActionDto
                    {
                        Module = "Clients",
                        Action = "Delete",
                        TargetID = id,
                        TargetName = client.FullName
                    },
                    GetUserId(), GetUserName(), GetUserRole());

                if (!created)
                    return Ok(new { requiresApproval = true, alreadyPending = true, message = $"A delete request for \"{client.FullName}\" is already awaiting approval." });

                return Ok(new { requiresApproval = true, message = $"Request to delete \"{client.FullName}\" sent to administration for approval." });
            }

            var deleted = await _service.DeleteClientAsync(id);
            if (!deleted)
                return NotFound(new { message = "Client not found" });

            await _notificationService.NotifyPersonalAsync(
                GetUserId(), "Client", "Client deleted", $"You deleted client: {client.FullName}.");
            await _notificationService.NotifyAdminsActivityAsync(
                "Client", "Client deleted", $"{GetUserName()} deleted client: {client.FullName}.");

            return Ok(new { message = "Client deleted successfully" });
        }
    }
}
