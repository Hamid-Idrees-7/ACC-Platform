export const ALERT_SEEN_KEY = "acc-open-alerts-seen";

export const ALERT_GROUPS = ["Money", "Stock and requests", "Projects", "Team", "Security"];

export const ALERT_SEVERITY = {
  Critical: { label: "Critical", rank: 0 },
  Warning: { label: "Warning", rank: 1 },
  Info: { label: "Heads-up", rank: 2 },
};

export const ALERT_LIVE_MODULES = ["alerts", "alert-rules", "permissions", "users", "assignments"];
