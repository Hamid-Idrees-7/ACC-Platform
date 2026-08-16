// Central config for Control Unit: which modules exist and what actions each has.
// As new modules are built, add them here to expose them in Control Unit.

export const MODULE_GROUPS = [
  {
    group: "Management",
    modules: [
      { key: "Clients", label: "Clients", actions: ["View", "Add", "Edit", "Delete"] },
      { key: "Employees", label: "Employees", actions: ["View", "Add", "Edit", "Delete"] },
    ],
  },
  // Operations group will be added as those modules are built
];

// Flat list of all modules (handy for lookups)
export const ALL_MODULES = MODULE_GROUPS.flatMap((g) => g.modules);

// Actions that support the "approval needed" option
export const APPROVAL_ACTIONS = ["Delete"];
