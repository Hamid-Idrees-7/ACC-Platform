// Central config for Control Unit: which modules exist and what actions each has.
// As new modules are built, add them here to expose them in Control Unit.

export const MODULE_GROUPS = [
  {
    group: "Management",
    modules: [
      // approvalActions: which actions can show the "approval needed" option for this module
      { key: "Clients", label: "Clients", actions: ["View", "Add", "Edit", "Delete"], approvalActions: ["Delete"] },
      { key: "Employees", label: "Employees", actions: ["View", "Add", "Edit", "Delete"], approvalActions: ["Delete"] },
      { key: "Materials", label: "Materials", actions: ["View", "Add", "Edit", "Manage", "Delete"], approvalActions: ["Delete"] },
      { key: "Projects", label: "Projects", actions: ["View", "Add", "Edit", "Manage", "Delete"], approvalActions: ["Delete"] },
      // One-off project costs (plot, transfer, taxes, possession) Shown inside a projects page.
      { key: "Expenses", label: "Project Expenses", actions: ["View", "Add", "Edit", "Delete"], approvalActions: ["Delete"] },
      { key: "Assignments", label: "Assignments", actions: ["View", "Add", "Edit", "Delete"], approvalActions: ["Delete"] },
      { key: "Attendance", label: "Attendance", actions: ["View", "Mark"], approvalActions: [] },
      { key: "Salaries", label: "Salaries", actions: ["View", "Manage"], approvalActions: [] },
      { key: "Billing", label: "Billing & Invoices", actions: ["View", "Manage"], approvalActions: [] },
      { key: "Reports", label: "Reports", actions: ["View"], approvalActions: [] },
    ],
  },
  {
    group: "Field Access",
    modules: [
      // Site-engineer scoped view. Scoping (own site only) is automatic from the user's
      // linked employee. Manage covers everything they do on their own site
      // (mark attendance, update progress, request material).
      { key: "Field", label: "Field View", actions: ["View", "Manage"], approvalActions: [] },
    ],
  },
  {
    group: "Workspace",
    modules: [
      // Messages and Approvals delete directly - no approval workflow (it would be circular)
      { key: "Messages", label: "Messages", actions: ["View", "Delete"], approvalActions: [] },
      { key: "Approvals", label: "Approvals", actions: ["View", "Manage", "Delete"], approvalActions: [] },
      // Reviewing site-engineer material requests. Kept separate from Materials so an
      // engineer who raises requests can never approve/reject their own. Manage = approve+issue / reject.
      { key: "MaterialRequests", label: "Material Requests", actions: ["View", "Manage"], approvalActions: [] },
    ],
  },
];

// Flat list of all modules (handy for lookups)
export const ALL_MODULES = MODULE_GROUPS.flatMap((g) => g.modules);
