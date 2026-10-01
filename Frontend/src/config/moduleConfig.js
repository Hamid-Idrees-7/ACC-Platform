// The modules Control Unit lists and the actions each one has. Add a new module here to
// show it in Control Unit.

export const MODULE_GROUPS = [
  {
    group: "Management",
    modules: [
      // approvalActions: which actions can show the "approval needed" option for this module
      { key: "Clients", label: "Clients", actions: ["View", "Add", "Edit", "Delete"], approvalActions: ["Delete"] },
      { key: "Employees", label: "Employees", actions: ["View", "Add", "Edit", "Delete"], approvalActions: ["Delete"] },
      { key: "Materials", label: "Materials", actions: ["View", "Add", "Edit", "Manage", "Delete"], approvalActions: ["Delete"] },
      { key: "Projects", label: "Projects", actions: ["View", "Add", "Edit", "Manage", "Delete"], approvalActions: ["Delete"] },
      // One-off project costs (plot, transfer, taxes, possession), shown on a project's page.
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
      // Site engineer view, limited to their own site (taken from the linked employee).
      // Manage covers everything they do there (mark attendance, update progress,
      // request material).
      { key: "Field", label: "Field View", actions: ["View", "Manage"], approvalActions: [] },
    ],
  },
  {
    group: "Workspace",
    modules: [
      // Messages and Approvals delete directly, with no approval step (it would be circular).
      { key: "Messages", label: "Messages", actions: ["View", "Delete"], approvalActions: [] },
      { key: "Approvals", label: "Approvals", actions: ["View", "Manage", "Delete"], approvalActions: [] },
      // Reviewing site engineers' material requests. Separate from Materials so an engineer
      // who raises requests can never approve or reject their own. Manage means approve and
      // issue, or reject.
      { key: "MaterialRequests", label: "Material Requests", actions: ["View", "Manage"], approvalActions: [] },
    ],
  },
];

// All modules in one flat list, for lookups.
export const ALL_MODULES = MODULE_GROUPS.flatMap((g) => g.modules);
