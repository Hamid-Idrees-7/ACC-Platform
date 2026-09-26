using System.Security.Claims;
using Backend.Auth;
using Backend.Models.DTOs;
using Backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Backend.Controllers
{
    // API endpoints for project expenses (plot fees, transfer fees, taxes, possession charges)
    // Base route: /api/expenses
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class ExpensesController : ControllerBase
    {
        private readonly IProjectExpenseService _service;
        private readonly IPermissionService _permissionService;
        private readonly IPendingActionService _approvalService;
        private readonly INotificationService _notificationService;

        public ExpensesController(
            IProjectExpenseService service,
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

        // GET /api/expenses/project/5 — all expenses of a project with totals
        [HttpGet("project/{projectId}")]
        [RequirePermission("Expenses", "View")]
        public async Task<IActionResult> GetForProject(int projectId)
        {
            var data = await _service.GetProjectExpensesAsync(projectId);
            if (data == null)
                return NotFound(new { message = "Project not found" });
            return Ok(data);
        }

        // POST /api/expenses/project/5 — add an expense to a project
        [HttpPost("project/{projectId}")]
        [RequirePermission("Expenses", "Add")]
        public async Task<IActionResult> Create(int projectId, [FromBody] SaveProjectExpenseDto dto)
        {
            var result = await _service.CreateAsync(projectId, dto, GetUserId());
            if (result.NotFound)
                return NotFound(new { message = "Project not found" });
            if (result.Error != null)
                return BadRequest(new { message = result.Error });

            var label = await _service.DescribeAsync(result.Expense!);
            await _notificationService.NotifyPersonalAsync(
                GetUserId(), "Expense", "Expense added", $"You added an expense: {label}.");
            await _notificationService.NotifyAdminsActivityAsync(
                "Expense", "New expense", $"{GetUserName()} added an expense: {label}.",
                excludeUserId: GetUserId());

            return Ok(result.Expense);
        }

        // PUT /api/expenses/9 — edit an expense
        [HttpPut("{id}")]
        [RequirePermission("Expenses", "Edit")]
        public async Task<IActionResult> Update(int id, [FromBody] SaveProjectExpenseDto dto)
        {
            var result = await _service.UpdateAsync(id, dto);
            if (result.NotFound)
                return NotFound(new { message = "Expense not found" });
            if (result.Error != null)
                return BadRequest(new { message = result.Error });

            // Money records are audited: admins see every change in Users Activity.
            var label = await _service.DescribeAsync(result.Expense!);
            await _notificationService.NotifyAdminsActivityAsync(
                "Expense", "Expense updated", $"{GetUserName()} updated an expense: {label}.",
                excludeUserId: GetUserId());

            return Ok(result.Expense);
        }

        // DELETE /api/expenses/9 — delete an expense (or request approval if required)
        [HttpDelete("{id}")]
        [RequirePermission("Expenses", "Delete")]
        public async Task<IActionResult> Delete(int id)
        {
            var expense = await _service.GetByIdAsync(id);
            if (expense == null)
                return NotFound(new { message = "Expense not found" });

            // A billed expense must first be removed from its invoice.
            var blocker = await _service.GetDeleteBlockerAsync(id);
            if (blocker != null)
                return BadRequest(new { message = blocker });

            var label = await _service.DescribeAsync(expense);

            if (!IsAdmin() && await _permissionService.RequiresApprovalAsync(GetUserId(), "Expenses", "Delete"))
            {
                var created = await _approvalService.CreateAsync(
                    new CreatePendingActionDto
                    {
                        Module = "Expenses",
                        Action = "Delete",
                        TargetID = id,
                        TargetName = label
                    },
                    GetUserId(), GetUserName(), GetUserRole());

                if (!created)
                    return Ok(new { requiresApproval = true, alreadyPending = true, message = "A delete request for this expense is already awaiting approval." });

                return Ok(new { requiresApproval = true, message = "Request to delete this expense sent to administration for approval." });
            }

            var deleted = await _service.DeleteAsync(id);
            if (!deleted)
                return NotFound(new { message = "Expense not found" });

            await _notificationService.NotifyPersonalAsync(
                GetUserId(), "Expense", "Expense deleted", $"You deleted an expense: {label}.");
            await _notificationService.NotifyAdminsActivityAsync(
                "Expense", "Expense deleted", $"{GetUserName()} deleted an expense: {label}.",
                excludeUserId: GetUserId());

            return Ok(new { message = "Expense deleted successfully" });
        }
    }
}
