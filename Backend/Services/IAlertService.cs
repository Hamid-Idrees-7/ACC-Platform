using Backend.Auth;
using Backend.Models.DTOs;
using Backend.Models.Entities;

namespace Backend.Services
{
    public interface IAlertService
    {
        Task<List<AlertDto>> GetForUserAsync(int userId, bool isAdmin, string status);
        Task<AlertSummaryDto> GetSummaryAsync(int userId, bool isAdmin);
        Task<bool> ResolveAsync(int alertId, int userId);
        Task<List<AlertRuleDto>> GetRulesAsync();
        Task<(List<AlertRuleDto>? Rules, string? Error)> SaveRuleAsync(string type, SaveAlertRuleDto dto, string? updatedBy);
        Task CheckNewDeviceAsync(User user, ClientInfo client, int loginActivityId);
    }
}
