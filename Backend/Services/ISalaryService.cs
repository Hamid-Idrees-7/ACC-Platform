using Backend.Models.DTOs;

namespace Backend.Services
{
    public interface ISalaryService
    {
        Task<SalaryPeriodDto> GetPeriodAsync(int year, int month, int? projectId);
        // Error is the reason the payment was refused (shown to the user).
        Task<(SalaryPeriodDto? Period, string? Error)> PayAsync(PaySalaryDto dto, int userId);
        Task<SalaryPeriodDto?> RevertAsync(int paymentId);
        Task<PayslipDto?> GetPayslipAsync(int employeeId, int year, int month);
        Task<SalaryPaymentSummary?> DescribePaymentAsync(int paymentId);
        Task<string> EmployeeNameAsync(int employeeId);
    }

    public record SalaryPaymentSummary(string EmployeeName, int Year, int Month, decimal Amount);
}
