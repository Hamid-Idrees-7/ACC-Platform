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
    public class AssignmentsController : ControllerBase
    {
        private readonly IAssignmentService _service;
        private readonly IPermissionService _permissionService;
        private readonly IPendingActionService _approvalService;
        private readonly INotificationService _notificationService;

        public AssignmentsController(
            IAssignmentService service,
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

        // GET: /api/assignments
        [HttpGet]
        [RequirePermission("Assignments", "View")]
        public async Task<IActionResult> GetAll()
        {
            var assignments = await _service.GetAllAsync();
            return Ok(assignments);
        }

        // GET: /api/assignments/5
        [HttpGet("{id}")]
        [RequirePermission("Assignments", "View")]
        public async Task<IActionResult> GetById(int id)
        {
            var assignment = await _service.GetByIdAsync(id);
            if (assignment == null)
                return NotFound(new { message = "Assignment not found" });

            return Ok(assignment);
        }

        // POST: /api/assignments
        [HttpPost]
        [RequirePermission("Assignments", "Add")]
        public async Task<IActionResult> Create([FromBody] CreateAssignmentDto dto)
        {
            var assignment = await _service.CreateAsync(dto);

            await _notificationService.NotifyPersonalAsync(
                GetUserId(), "Assignment", "Assignment created",
                $"You assigned {assignment.EmployeeName} to {assignment.ProjectTitle}.");
            await _notificationService.NotifyAdminsActivityAsync(
                "Assignment", "New assignment",
                $"{GetUserName()} assigned {assignment.EmployeeName} to {assignment.ProjectTitle}.");

            return CreatedAtAction(nameof(GetById), new { id = assignment.AssignmentID }, assignment);
        }

        // PUT: /api/assignments/5
        [HttpPut("{id}")]
        [RequirePermission("Assignments", "Edit")]
        public async Task<IActionResult> Update(int id, [FromBody] CreateAssignmentDto dto)
        {
            var assignment = await _service.UpdateAsync(id, dto);
            if (assignment == null)
                return NotFound(new { message = "Assignment not found" });

            return Ok(assignment);
        }

        // PUT: /api/assignments/5/end
        [HttpPut("{id}/end")]
        [RequirePermission("Assignments", "Edit")]
        public async Task<IActionResult> End(int id)
        {
            var assignment = await _service.EndAsync(id);
            if (assignment == null)
                return NotFound(new { message = "Assignment not found" });

            return Ok(assignment);
        }

        // DELETE: /api/assignments/5 (or request approval if required)
        [HttpDelete("{id}")]
        [RequirePermission("Assignments", "Delete")]
        public async Task<IActionResult> Delete(int id)
        {
            var assignment = await _service.GetByIdAsync(id);
            if (assignment == null)
                return NotFound(new { message = "Assignment not found" });

            if (!IsAdmin() && await _permissionService.RequiresApprovalAsync(GetUserId(), "Assignments", "Delete"))
            {
                var created = await _approvalService.CreateAsync(
                    new CreatePendingActionDto
                    {
                        Module = "Assignments",
                        Action = "Delete",
                        TargetID = id,
                        TargetName = $"{assignment.EmployeeName} → {assignment.ProjectTitle}"
                    },
                    GetUserId(), GetUserName(), GetUserRole());

                if (!created)
                    return Ok(new { requiresApproval = true, alreadyPending = true, message = $"A delete request for this assignment is already awaiting approval." });

                return Ok(new { requiresApproval = true, message = $"Request to delete this assignment sent to administration for approval." });
            }

            var deleted = await _service.DeleteAsync(id);
            if (!deleted)
                return NotFound(new { message = "Assignment not found" });

            await _notificationService.NotifyPersonalAsync(
                GetUserId(), "Assignment", "Assignment deleted",
                $"You removed {assignment.EmployeeName} from {assignment.ProjectTitle}.");
            await _notificationService.NotifyAdminsActivityAsync(
                "Assignment", "Assignment deleted",
                $"{GetUserName()} removed {assignment.EmployeeName} from {assignment.ProjectTitle}.");

            return Ok(new { message = "Assignment deleted successfully" });
        }
    }
}
