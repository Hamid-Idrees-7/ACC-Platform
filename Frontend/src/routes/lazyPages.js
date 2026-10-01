import { lazy } from "react";

const loaders = {
  About: () => import("../pages/About"),
  Projects: () => import("../pages/Projects"),
  Privacy: () => import("../pages/Privacy"),
  ResetPassword: () => import("../pages/ResetPassword"),
  Dashboard: () => import("../pages/Dashboard"),
  Queries: () => import("../pages/Queries"),
  Profile: () => import("../pages/Profile"),
  Settings: () => import("../pages/Settings"),
  ControlUnit: () => import("../pages/ControlUnit"),
  ManageAccess: () => import("../pages/ManageAccess"),
  Approvals: () => import("../pages/Approvals"),
  Notifications: () => import("../pages/Notifications"),
  Alerts: () => import("../pages/Alerts"),
  Clients: () => import("../pages/Clients"),
  Employees: () => import("../pages/Employees"),
  Users: () => import("../pages/Users"),
  Materials: () => import("../pages/Materials"),
  MaterialHistory: () => import("../pages/MaterialHistory"),
  ProjectManagement: () => import("../pages/ProjectManagement"),
  ProjectDetail: () => import("../pages/ProjectDetail"),
  Assignments: () => import("../pages/Assignments"),
  Attendance: () => import("../pages/Attendance"),
  MarkAttendance: () => import("../pages/MarkAttendance"),
  Salaries: () => import("../pages/Salaries"),
  Payslip: () => import("../pages/Payslip"),
  Billing: () => import("../pages/Billing"),
  ProjectBilling: () => import("../pages/ProjectBilling"),
  InvoicePrint: () => import("../pages/InvoicePrint"),
  Reports: () => import("../pages/Reports"),
  FieldView: () => import("../pages/FieldView"),
  MaterialRequests: () => import("../pages/MaterialRequests"),
  UnderConstruction: () => import("../pages/UnderConstruction"),
};

const RELOAD_KEY = "acc-chunk-reload";

const withRetry = (load) => () =>
  load().then(
    (module) => {
      try { sessionStorage.removeItem(RELOAD_KEY); } catch { /* storage unavailable */ }
      return module;
    },
    (error) => {
      let reloaded = false;
      try { reloaded = sessionStorage.getItem(RELOAD_KEY) === "1"; } catch { /* storage unavailable */ }
      if (!reloaded) {
        try { sessionStorage.setItem(RELOAD_KEY, "1"); } catch { /* storage unavailable */ }
        window.location.reload();
        return new Promise(() => {});
      }
      throw error;
    }
  );

export const pages = Object.fromEntries(Object.entries(loaders).map(([name, load]) => [name, lazy(withRetry(load))]));

let prefetched = false;

export function prefetchDashboardPages() {
  if (prefetched) return;
  prefetched = true;
  const run = () => Object.values(loaders).forEach((load) => load().catch(() => {}));
  if ("requestIdleCallback" in window) window.requestIdleCallback(run, { timeout: 4000 });
  else setTimeout(run, 1500);
}
