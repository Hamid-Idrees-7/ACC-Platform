using System.Security.Claims;
using Backend.Auth;
using Backend.Models.DTOs;
using Backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Backend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class MaterialsController : ControllerBase
    {
        private readonly IMaterialService _service;
        private readonly IPermissionService _permissionService;
        private readonly IPendingActionService _approvalService;
        private readonly INotificationService _notificationService;
        private readonly IProjectService _projectService;

        public MaterialsController(
            IMaterialService service,
            IPermissionService permissionService,
            IPendingActionService approvalService,
            INotificationService notificationService,
            IProjectService projectService)
        {
            _service = service;
            _permissionService = permissionService;
            _approvalService = approvalService;
            _notificationService = notificationService;
            _projectService = projectService;
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

        // GET: /api/materials
        [HttpGet]
        [RequirePermission("Materials", "View")]
        public async Task<IActionResult> GetAll()
        {
            var materials = await _service.GetAllMaterialsAsync();
            return Ok(materials);
        }

        // GET: /api/materials/5
        [HttpGet("{id}")]
        [RequirePermission("Materials", "View")]
        public async Task<IActionResult> GetById(int id)
        {
            var material = await _service.GetMaterialByIdAsync(id);
            if (material == null)
                return NotFound(new { message = "Material not found" });

            return Ok(material);
        }

        // GET: /api/materials/5/history
        [HttpGet("{id}/history")]
        [RequirePermission("Materials", "View")]
        public async Task<IActionResult> GetHistory(int id)
        {
            var history = await _service.GetHistoryAsync(id);
            if (history == null)
                return NotFound(new { message = "Material not found" });

            return Ok(history);
        }

        // GET: /api/materials/projects  = the open projects stock can be issued to.
        // Part of issuing stock, so it needs Materials access only (not the Projects module).
        [HttpGet("projects")]
        [RequirePermission("Materials", "Manage")]
        public async Task<IActionResult> IssueProjects()
        {
            var projects = await _projectService.GetAllProjectsAsync();
            return Ok(projects
                .Where(p => p.Status != "Completed" && p.Status != "Cancelled")
                .OrderBy(p => p.Title)
                .Select(p => new { p.ProjectID, p.Title }));
        }

        // GET: /api/materials/projects/5/phases  = that project's phases, for issuing stock
        [HttpGet("projects/{projectId}/phases")]
        [RequirePermission("Materials", "Manage")]
        public async Task<IActionResult> IssuePhases(int projectId)
        {
            return Ok(await _projectService.GetPhaseListAsync(projectId));
        }

        // POST: /api/materials
        [HttpPost]
        [RequirePermission("Materials", "Add")]
        public async Task<IActionResult> Create([FromBody] CreateMaterialDto dto)
        {
            var invalid = MaterialService.CheckCreate(dto);
            if (invalid != null)
                return BadRequest(new { message = invalid });

            var material = await _service.CreateMaterialAsync(dto);

            await _notificationService.NotifyPersonalAsync(
                GetUserId(), "Material", "Material added", $"You added material: {material.Name}.",
                link: NotificationLinks.Material(material.MaterialID));
            await _notificationService.NotifyAdminsActivityAsync(
                "Material", "New material", $"{GetUserName()} added material: {material.Name}.",
                link: NotificationLinks.Material(material.MaterialID));

            return CreatedAtAction(nameof(GetById), new { id = material.MaterialID }, material);
        }

        // PUT: /api/materials/5
        [HttpPut("{id}")]
        [RequirePermission("Materials", "Edit")]
        public async Task<IActionResult> Update(int id, [FromBody] CreateMaterialDto dto)
        {
            var invalid = await _service.CheckUpdateAsync(id, dto);
            if (invalid != null)
                return BadRequest(new { message = invalid });

            var material = await _service.UpdateMaterialAsync(id, dto);
            if (material == null)
                return NotFound(new { message = "Material not found" });

            return Ok(material);
        }

        // POST: /api/materials/5/restock
        [HttpPost("{id}/restock")]
        [RequirePermission("Materials", "Manage")]
        public async Task<IActionResult> Restock(int id, [FromBody] RestockDto dto)
        {
            var result = await _service.RestockAsync(id, dto);
            if (!result.Success)
                return BadRequest(new { message = result.Error });

            var material = result.Material!;
            var added = $"{Math.Round(dto.Quantity, 2):0.##} {material.Unit} of {material.Name}";
            await _notificationService.NotifyPersonalAsync(
                GetUserId(), "Material", "Stock added", $"You restocked {added}.",
                link: NotificationLinks.MaterialHistory(id));
            await _notificationService.NotifyAdminsActivityAsync(
                "Material", "Stock added", $"{GetUserName()} restocked {added}.",
                link: NotificationLinks.MaterialHistory(id));

            return Ok(material);
        }

        // POST: /api/materials/5/issue
        [HttpPost("{id}/issue")]
        [RequirePermission("Materials", "Manage")]
        public async Task<IActionResult> Issue(int id, [FromBody] IssueDto dto)
        {
            var result = await _service.IssueAsync(id, dto);
            if (!result.Success)
                return BadRequest(new { message = result.Error });

            var material = result.Material!;
            var issued = result.Transaction!;
            var what = $"{issued.Quantity:0.##} {material.Unit} of {material.Name} to {issued.ProjectName}";
            await _notificationService.NotifyPersonalAsync(
                GetUserId(), "Material", "Stock issued", $"You issued {what}.",
                link: NotificationLinks.MaterialHistory(id));
            await _notificationService.NotifyAdminsActivityAsync(
                "Material", "Stock issued", $"{GetUserName()} issued {what}.",
                link: NotificationLinks.MaterialHistory(id));

            return Ok(material);
        }

        // POST: /api/materials/transactions/9/cancel
        [HttpPost("transactions/{txId}/cancel")]
        [RequirePermission("Materials", "Manage")]
        public async Task<IActionResult> CancelTransaction(int txId)
        {
            var result = await _service.CancelTransactionAsync(txId);
            if (!result.Success)
                return BadRequest(new { message = result.Error });

            if (result.Material != null && result.Transaction != null)
            {
                var material = result.Material;
                var tx = result.Transaction;
                var amount = $"{tx.Quantity:0.##} {material.Unit} of {material.Name}";
                var what = tx.Type == "Issue"
                    ? $"the issue of {amount} to {tx.ProjectName ?? "a project"}. The stock went back to the store."
                    : $"the purchase of {amount}. It is no longer in stock.";
                await _notificationService.NotifyPersonalAsync(
                    GetUserId(), "Material", "Stock entry cancelled", $"You cancelled {what}",
                    link: NotificationLinks.MaterialHistory(material.MaterialID));
                await _notificationService.NotifyAdminsActivityAsync(
                    "Material", "Stock entry cancelled", $"{GetUserName()} cancelled {what}",
                    link: NotificationLinks.MaterialHistory(material.MaterialID));
            }

            return Ok(result.Material);
        }

        // DELETE: /api/materials/5  = delete, or ask for approval when required
        [HttpDelete("{id}")]
        [RequirePermission("Materials", "Delete")]
        public async Task<IActionResult> Delete(int id)
        {
            var material = await _service.GetMaterialByIdAsync(id);
            if (material == null)
                return NotFound(new { message = "Material not found" });

            // A material already issued to projects can't be deleted (it is part of their history).
            if (await _service.HasIssuesAsync(id))
                return BadRequest(new { message = "This material has been issued to projects, so it can't be deleted. Keep it and set it to Inactive instead, or cancel its issues from the History page first." });

            // Non-admins may need approval before the delete runs.
            if (!IsAdmin() && await _permissionService.RequiresApprovalAsync(GetUserId(), "Materials", "Delete"))
            {
                var created = await _approvalService.CreateAsync(
                    new CreatePendingActionDto
                    {
                        Module = "Materials",
                        Action = "Delete",
                        TargetID = id,
                        TargetName = material.Name
                    },
                    GetUserId(), GetUserName(), GetUserRole());

                if (!created)
                    return Ok(new { requiresApproval = true, alreadyPending = true, message = $"A delete request for \"{material.Name}\" is already awaiting approval." });

                return Ok(new { requiresApproval = true, message = $"Request to delete \"{material.Name}\" sent to administration for approval." });
            }

            var deleted = await _service.DeleteMaterialAsync(id);
            if (!deleted)
                return NotFound(new { message = "Material not found" });

            await _notificationService.NotifyPersonalAsync(
                GetUserId(), "Material", "Material deleted", $"You deleted material: {material.Name}.");
            await _notificationService.NotifyAdminsActivityAsync(
                "Material", "Material deleted", $"{GetUserName()} deleted material: {material.Name}.");

            return Ok(new { message = "Material deleted successfully" });
        }
    }
}
