using System.Security.Claims;
using Backend.Services;

namespace Backend.Auth
{
    // Wages and project money are shown only to people who work with money: the admin, or
    // anyone who can view at least one of the given modules. Everyone else sees the same
    // screens without the amounts.
    public static class MoneyAccess
    {
        // Project financials (cost, profit, material amounts)
        public static readonly string[] ProjectMoney = { "Salaries", "Billing", "Expenses", "Reports" };

        // What each person is paid
        public static readonly string[] Wages = { "Salaries", "Assignments" };

        public static async Task<bool> CanSeeAsync(ClaimsPrincipal user, IPermissionService permissions, string[] modules)
        {
            var role = user.FindFirst(ClaimTypes.Role)?.Value ?? user.FindFirst("role")?.Value;
            if (string.Equals(role, "Admin", StringComparison.OrdinalIgnoreCase)) return true;
            if (!int.TryParse(user.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var userId)) return false;

            foreach (var module in modules)
                if (await permissions.HasPermissionAsync(userId, module, "View")) return true;
            return false;
        }
    }
}
