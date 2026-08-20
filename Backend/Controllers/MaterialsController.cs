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

        public MaterialsController(
            IMaterialService service,
            IPermissionService permissionService,
            IPendingActionService approvalService,
            INotificationService notificationService)
        {
            _service = service;
            _permissionService = permissionService;
            _approvalService = approvalService;
            _notificationService = notificationService;
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

        // POST: /api/materials
        [HttpPost]
        [RequirePermission("Materials", "Add")]
        public async Task<IActionResult> Create([FromBody] CreateMaterialDto dto)
        {
            var material = await _service.CreateMaterialAsync(dto);

            await _notificationService.NotifyPersonalAsync(
                GetUserId(), "Material", "Material added", $"You added material: {material.Name}.");
            await _notificationService.NotifyAdminsActivityAsync(
                "Material", "New material", $"{GetUserName()} added material: {material.Name}.");

            return CreatedAtAction(nameof(GetById), new { id = material.MaterialID }, material);
        }

        // PUT: /api/materials/5
        [HttpPut("{id}")]
        [RequirePermission("Materials", "Edit")]
        public async Task<IActionResult> Update(int id, [FromBody] CreateMaterialDto dto)
        {
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
            await _notificationService.NotifyPersonalAsync(
                GetUserId(), "Material", "Stock added",
                $"You restocked {dto.Quantity} {material.Unit} of {material.Name}.");
            await _notificationService.NotifyAdminsActivityAsync(
                "Material", "Stock added",
                $"{GetUserName()} restocked {dto.Quantity} {material.Unit} of {material.Name}.");

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
            await _notificationService.NotifyPersonalAsync(
                GetUserId(), "Material", "Stock issued",
                $"You issued {dto.Quantity} {material.Unit} of {material.Name} to {dto.ProjectName}.");
            await _notificationService.NotifyAdminsActivityAsync(
                "Material", "Stock issued",
                $"{GetUserName()} issued {dto.Quantity} {material.Unit} of {material.Name} to {dto.ProjectName}.");

            return Ok(material);
        }

        // DELETE: /api/materials/5 (or request approval if required)
        [HttpDelete("{id}")]
        [RequirePermission("Materials", "Delete")]
        public async Task<IActionResult> Delete(int id)
        {
            var material = await _service.GetMaterialByIdAsync(id);
            if (material == null)
                return NotFound(new { message = "Material not found" });

            // Non-admins may need approval before a delete actually runs
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

            // Otherwise delete directly
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
