// Central config for Control Unit: which modules exist and what actions each has.
// As new modules are built, add them here to expose them in Control Unit.

export const MODULE_GROUPS = [
  {
    group: "Management",
    modules: [
      // approvalActions: which actions can show the "approval needed" option for this module
      { key: "Clients", label: "Clients", actions: ["View", "Add", "Edit", "Delete"], approvalActions: ["Delete"] },
      { key: "Employees", label: "Employees", actions: ["View", "Add", "Edit", "Delete"], approvalActions: ["Delete"] },
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
