using Backend.Alerts;

namespace Backend.Services
{
    public interface IAlertCheckService
    {
        Task<AlertChanges> RunAsync(CancellationToken ct = default);
    }
}
