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
      { key: "Assignments", label: "Assignments", actions: ["View", "Add", "Edit", "Delete"], approvalActions: ["Delete"] },
      { key: "Attendance", label: "Attendance", actions: ["View", "Mark"], approvalActions: [] },
      { key: "Salaries", label: "Salaries", actions: ["View", "Manage"], approvalActions: [] },
      { key: "Billing", label: "Billing & Invoices", actions: ["View", "Manage"], approvalActions: [] },
      { key: "Reports", label: "Reports", actions: ["View"], approvalActions: [] },
    ],
  },
  {
    group: "Workspace",
    modules: [
      // Messages and Approvals delete directly - no approval workflow (it would be circular)
      { key: "Messages", label: "Messages", actions: ["View", "Delete"], approvalActions: [] },
      { key: "Approvals", label: "Approvals", actions: ["View", "Manage", "Delete"], approvalActions: [] },
    ],
  },
];

// Flat list of all modules (handy for lookups)
export const ALL_MODULES = MODULE_GROUPS.flatMap((g) => g.modules);
