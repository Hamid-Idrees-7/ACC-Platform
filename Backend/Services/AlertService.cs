using System.Globalization;
using Backend.Alerts;
using Backend.Auth;
using Backend.Models.DTOs;
using Backend.Models.Entities;
using Backend.Repositories;

namespace Backend.Services
{
    public class AlertService : IAlertService
    {
        private static readonly Dictionary<string, int> SeverityRank = new()
        {
            [AlertSeverities.Critical] = 0,
            [AlertSeverities.Warning] = 1,
            [AlertSeverities.Info] = 2
        };

        private readonly IAlertRepository _repository;
        private readonly IPermissionRepository _permissions;
        private readonly IUserRepository _users;
        private readonly IAssignmentRepository _assignments;
        private readonly ILoginActivityRepository _logins;
        private readonly ILogger<AlertService> _logger;

        public AlertService(
            IAlertRepository repository,
            IPermissionRepository permissions,
            IUserRepository users,
            IAssignmentRepository assignments,
            ILoginActivityRepository logins,
            ILogger<AlertService> logger)
        {
            _repository = repository;
            _permissions = permissions;
            _users = users;
            _assignments = assignments;
            _logins = logins;
            _logger = logger;
        }

        public async Task<List<AlertDto>> GetForUserAsync(int userId, bool isAdmin, string status)
        {
            var viewer = await ViewerAsync(userId, isAdmin);
            var resolved = status == AlertStatuses.Resolved;
            var alerts = resolved
                ? await _repository.GetResolvedSinceAsync(DateTime.Now - AlertCatalog.KeepResolved)
                : await _repository.GetOpenAsync();

            var visible = alerts.Where(viewer.CanSee);
            visible = resolved
                ? visible.OrderByDescending(a => a.ResolvedAt)
                : visible.OrderBy(a => SeverityRank.GetValueOrDefault(a.Severity, 3)).ThenByDescending(a => a.CreatedAt);

            return visible.Select(a => ToDto(a, viewer)).ToList();
        }

        public async Task<AlertSummaryDto> GetSummaryAsync(int userId, bool isAdmin)
        {
            var viewer = await ViewerAsync(userId, isAdmin);
            var open = (await _repository.GetOpenAsync()).Where(viewer.CanSee).ToList();
            return new AlertSummaryDto
            {
                Open = open.Count,
                Critical = open.Count(a => a.Severity == AlertSeverities.Critical),
                LatestId = open.Count == 0 ? 0 : open.Max(a => a.AlertID)
            };
        }

        public async Task<bool> ResolveAsync(int alertId, int userId)
        {
            var alert = await _repository.GetAsync(alertId);
            if (alert == null || alert.Status != AlertStatuses.Open || alert.UserID != userId) return false;
            if (AlertCatalog.Get(alert.Type) is not { Personal: true }) return false;

            alert.Status = AlertStatuses.Resolved;
            alert.ResolvedAt = DateTime.Now;
            alert.UpdatedAt = DateTime.Now;
            await _repository.UpdateAsync(alert);
            return true;
        }

        public async Task<List<AlertRuleDto>> GetRulesAsync()
        {
            var rules = new AlertRuleSet(await _repository.GetRulesAsync());
            return AlertCatalog.All.Select(info =>
            {
                var setting = rules.For(info.Type);
                return new AlertRuleDto
                {
                    Type = info.Type,
                    Group = info.Group,
                    Label = info.Label,
                    Description = info.Description,
                    Severity = info.Severity,
                    Audience = info.Audience,
                    Enabled = setting.Enabled,
                    Threshold = setting.Threshold,
                    DefaultThreshold = info.DefaultThreshold,
                    ThresholdLabel = info.ThresholdLabel,
                    Unit = info.Unit,
                    Min = info.Min,
                    Max = info.Max
                };
            }).ToList();
        }

        public async Task<(List<AlertRuleDto>? Rules, string? Error)> SaveRuleAsync(string type, SaveAlertRuleDto dto, string? updatedBy)
        {
            var info = AlertCatalog.Get(type);
            if (info == null) return (null, "This alert does not exist.");

            if (info.HasThreshold && dto.Threshold.HasValue && (dto.Threshold < info.Min || dto.Threshold > info.Max))
                return (null, $"Enter a number from {info.Min} to {info.Max}.");

            var rule = await _repository.GetRuleAsync(type) ?? new AlertRule { Type = type };
            rule.Enabled = dto.Enabled;
            rule.Threshold = info.HasThreshold ? dto.Threshold ?? rule.Threshold ?? info.DefaultThreshold : null;
            rule.UpdatedAt = DateTime.Now;
            rule.UpdatedBy = string.IsNullOrWhiteSpace(updatedBy) ? null : updatedBy.Trim();
            await _repository.SaveRuleAsync(rule);

            return (await GetRulesAsync(), null);
        }

        public async Task CheckNewDeviceAsync(User user, ClientInfo client, int loginActivityId)
        {
            try
            {
                var rules = new AlertRuleSet(await _repository.GetRulesAsync());
                if (!rules.IsEnabled(AlertTypes.NewDevice)) return;

                var device = DeviceInfo.From(client.UserAgent);
                var earlier = await _logins.GetSignInAgentsAsync(user.UserID, loginActivityId);
                if (earlier.Count == 0) return;
                if (earlier.Select(DeviceInfo.From).Any(d => d.Browser == device.Browser && d.Os == device.Os)) return;

                var now = DateTime.Now;
                var from = string.IsNullOrWhiteSpace(client.IpAddress) ? "" : $" (IP address {client.IpAddress})";
                var alert = AlertConditions.Make(AlertTypes.NewDevice, $"{loginActivityId}",
                    $"New sign-in from {device.Browser} on {device.Os}",
                    $"Your account was signed in on {AlertConditions.Date(now)} at {now.ToString("h:mm tt", CultureInfo.InvariantCulture)} from a browser or device it has not used before{from}. If this was not you, sign that device out and change your password.",
                    "/dashboard/settings?tab=security", userId: user.UserID);
                alert.CreatedAt = now;
                alert.UpdatedAt = now;
                await _repository.AddAsync(alert);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "The new device check could not run.");
            }
        }

        private static AlertDto ToDto(Alert a, Viewer viewer)
        {
            var info = AlertCatalog.Get(a.Type);
            return new AlertDto
            {
                AlertID = a.AlertID,
                Type = a.Type,
                Group = info?.Group ?? "",
                Severity = a.Severity,
                Title = a.Title,
                Message = a.Message,
                Link = viewer.LinkFor(a, info),
                Status = a.Status,
                CreatedAt = a.CreatedAt,
                UpdatedAt = a.UpdatedAt,
                ResolvedAt = a.ResolvedAt,
                CanResolve = a.Status == AlertStatuses.Open && info?.Personal == true && a.UserID == viewer.UserId
            };
        }

        private async Task<Viewer> ViewerAsync(int userId, bool isAdmin)
        {
            if (isAdmin) return new Viewer(userId, true, new HashSet<(string, string)>(), new HashSet<int>());

            var allowed = (await _permissions.GetByUserAsync(userId))
                .Where(p => p.IsAllowed)
                .Select(p => (p.Module, p.Action))
                .ToHashSet();

            var sites = new HashSet<int>();
            if (allowed.Contains(("Field", "View")))
            {
                var user = await _users.GetByIdAsync(userId);
                if (user?.EmployeeID != null)
                    sites = (await _assignments.GetAllAsync())
                        .Where(a => a.EmployeeID == user.EmployeeID.Value)
                        .Select(a => a.ProjectID)
                        .ToHashSet();
            }

            return new Viewer(userId, false, allowed, sites);
        }

        private sealed record Viewer(int UserId, bool IsAdmin, HashSet<(string Module, string Action)> Allowed, HashSet<int> Sites)
        {
            private bool Can(string module, string action) =>
                IsAdmin || (Allowed.Contains((module, "View")) && Allowed.Contains((module, action)));

            public bool CanSee(Alert alert)
            {
                var info = AlertCatalog.Get(alert.Type);
                if (info == null) return false;
                if (info.Personal) return alert.UserID == UserId;
                if (info.Module != null && Can(info.Module, info.Action)) return true;
                return info.FieldSites && alert.ProjectID.HasValue && Sites.Contains(alert.ProjectID.Value);
            }

            public string? LinkFor(Alert alert, AlertTypeInfo? info)
            {
                if (info is { FieldSites: true, Module: not null } && !Can(info.Module, info.Action)) return "/dashboard/field";
                return alert.Link;
            }
        }
    }
}
