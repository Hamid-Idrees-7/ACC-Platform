using Backend.Models.DTOs;
using Backend.Models.Entities;

namespace Backend.Services
{
    public interface ISalaryService
    {
        Task<SalaryPeriodDto> GetPeriodAsync(int year, int month, int? projectId);
        // Error is the reason the payment was refused (shown to the user).
        Task<(SalaryPeriodDto? Period, string? Error)> PayAsync(PaySalaryDto dto, int userId);
        Task<(SalaryPeriodDto? Period, string? Error)> RevertAsync(int paymentId);
        Task<PayslipDto?> GetPayslipAsync(int employeeId, int year, int month);
        Task<SalaryPaymentSummary?> DescribePaymentAsync(int paymentId);
        Task<string> EmployeeNameAsync(int employeeId);

        // Refuses an assignment edit that would make a paid month earn less than was paid.
        Task<string?> PaidHistoryErrorAsync(Assignment original, Assignment changed);
    }

    public record SalaryPaymentSummary(string EmployeeName, int Year, int Month, decimal Amount);
}
