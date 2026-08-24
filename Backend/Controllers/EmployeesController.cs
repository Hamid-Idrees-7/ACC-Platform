using System.Security.Claims;
using Backend.Auth;
using Backend.Models.DTOs;
using Backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Backend.Controllers
{
    // API endpoints for employees. Base route: /api/employees
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class EmployeesController : ControllerBase
    {
        private readonly IEmployeeService _service;
        private readonly IPermissionService _permissionService;
        private readonly IPendingActionService _approvalService;
        private readonly INotificationService _notificationService;

        public EmployeesController(
            IEmployeeService service,
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

        // GET: /api/employees
        [HttpGet]
        [RequirePermission("Employees", "View")]
        public async Task<IActionResult> GetAll()
        {
            var employees = await _service.GetAllEmployeesAsync();
            return Ok(employees);
        }

        // GET: /api/employees/5
        [HttpGet("{id}")]
        [RequirePermission("Employees", "View")]
        public async Task<IActionResult> GetById(int id)
        {
            var employee = await _service.GetEmployeeByIdAsync(id);
            if (employee == null)
                return NotFound(new { message = "Employee not found" });

            return Ok(employee);
        }

        // POST: /api/employees
        [HttpPost]
        [RequirePermission("Employees", "Add")]
        public async Task<IActionResult> Create([FromBody] CreateEmployeeDto dto)
        {
            var employee = await _service.CreateEmployeeAsync(dto);

            await _notificationService.NotifyPersonalAsync(
                GetUserId(), "Employee", "Employee added", $"You added employee: {employee.FullName}.");
            await _notificationService.NotifyAdminsActivityAsync(
                "Employee", "New employee", $"{GetUserName()} added employee: {employee.FullName}.");

            return CreatedAtAction(nameof(GetById), new { id = employee.EmployeeID }, employee);
        }

        // PUT: /api/employees/5 (also covers enable/disable)
        [HttpPut("{id}")]
        [RequirePermission("Employees", "Edit")]
        public async Task<IActionResult> Update(int id, [FromBody] CreateEmployeeDto dto)
        {
            var employee = await _service.UpdateEmployeeAsync(id, dto);
            if (employee == null)
                return NotFound(new { message = "Employee not found" });

            return Ok(employee);
        }

        // DELETE: /api/employees/5 (or request approval if required)
        [HttpDelete("{id}")]
        [RequirePermission("Employees", "Delete")]
        public async Task<IActionResult> Delete(int id)
        {
            var employee = await _service.GetEmployeeByIdAsync(id);
            if (employee == null)
                return NotFound(new { message = "Employee not found" });

            // Referential-integrity guard: an employee tied to any assignment must be
            // kept for history. Recommend Inactive over deletion.
            if (await _service.HasAssignmentsAsync(id))
                return Conflict(new { message = $"\"{employee.FullName}\" has project assignments and cannot be deleted. Set the employee to Inactive instead to keep the assignment history." });

            // Non-admins may need approval before a delete actually runs
            if (!IsAdmin() && await _permissionService.RequiresApprovalAsync(GetUserId(), "Employees", "Delete"))
            {
                var created = await _approvalService.CreateAsync(
                    new CreatePendingActionDto
                    {
                        Module = "Employees",
                        Action = "Delete",
                        TargetID = id,
                        TargetName = employee.FullName
                    },
                    GetUserId(), GetUserName(), GetUserRole());

                if (!created)
                    return Ok(new { requiresApproval = true, alreadyPending = true, message = $"A delete request for \"{employee.FullName}\" is already awaiting approval." });

                return Ok(new { requiresApproval = true, message = $"Request to delete \"{employee.FullName}\" sent to administration for approval." });
            }

            // Otherwise delete directly
            var deleted = await _service.DeleteEmployeeAsync(id);
            if (!deleted)
                return NotFound(new { message = "Employee not found" });

            await _notificationService.NotifyPersonalAsync(
                GetUserId(), "Employee", "Employee deleted", $"You deleted employee: {employee.FullName}.");
            await _notificationService.NotifyAdminsActivityAsync(
                "Employee", "Employee deleted", $"{GetUserName()} deleted employee: {employee.FullName}.");

            return Ok(new { message = "Employee deleted successfully" });
        }
    }
}
