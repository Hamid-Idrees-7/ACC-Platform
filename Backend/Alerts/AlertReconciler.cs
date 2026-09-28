using Backend.Models.Entities;

namespace Backend.Alerts
{
    public class AlertChanges
    {
        public List<Alert> Added { get; } = new();
        public List<Alert> Updated { get; } = new();
        public List<Alert> Resolved { get; } = new();
        public List<Alert> Removed { get; } = new();

        public bool Any => Added.Count + Updated.Count + Resolved.Count + Removed.Count > 0;
    }

    public static class AlertReconciler
    {
        public static AlertChanges Reconcile(IEnumerable<Alert> open, IEnumerable<Alert> found, AlertRuleSet rules, DateTime now)
        {
            var changes = new AlertChanges();
            var pending = new Dictionary<string, Alert>();
            foreach (var alert in found)
                pending.TryAdd(alert.Key, alert);

            var seen = new HashSet<string>();
            foreach (var alert in open.OrderBy(a => a.AlertID))
            {
                var info = AlertCatalog.Get(alert.Type);
                if (info == null || !rules.IsEnabled(alert.Type) || !seen.Add(alert.Key))
                {
                    changes.Removed.Add(alert);
                    pending.Remove(alert.Key);
                    continue;
                }

                if (info.Personal)
                {
                    if (alert.CreatedAt <= now - AlertCatalog.PersonalAlertLifetime) Resolve(alert, now, changes);
                    continue;
                }

                if (pending.Remove(alert.Key, out var current))
                {
                    if (Refresh(alert, current, now)) changes.Updated.Add(alert);
                    continue;
                }

                if (AlertConditions.IsPastLookback(alert, now))
                {
                    changes.Removed.Add(alert);
                    continue;
                }

                Resolve(alert, now, changes);
            }

            foreach (var alert in pending.Values)
            {
                var info = AlertCatalog.Get(alert.Type);
                if (info == null || info.Personal || !rules.IsEnabled(alert.Type)) continue;
                alert.Status = AlertStatuses.Open;
                alert.CreatedAt = now;
                alert.UpdatedAt = now;
                alert.ResolvedAt = null;
                changes.Added.Add(alert);
            }

            return changes;
        }

        private static void Resolve(Alert alert, DateTime now, AlertChanges changes)
        {
            alert.Status = AlertStatuses.Resolved;
            alert.ResolvedAt = now;
            alert.UpdatedAt = now;
            changes.Resolved.Add(alert);
        }

        private static bool Refresh(Alert alert, Alert current, DateTime now)
        {
            if (alert.Title == current.Title && alert.Message == current.Message && alert.Severity == current.Severity
                && alert.Link == current.Link && alert.ProjectID == current.ProjectID)
                return false;

            alert.Title = current.Title;
            alert.Message = current.Message;
            alert.Severity = current.Severity;
            alert.Link = current.Link;
            alert.ProjectID = current.ProjectID;
            alert.UpdatedAt = now;
            return true;
        }
    }
}
