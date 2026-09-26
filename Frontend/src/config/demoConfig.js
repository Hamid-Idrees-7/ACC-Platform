// Roles a visitor can explore in the live demo. Keys match the backend (/api/demo).
export const DEMO_ROLES = [
  {
    key: "admin",
    label: "Admin",
    shortLabel: "Admin",
    tagline: "Full access: every module, approvals and access control.",
  },
  {
    key: "manager",
    label: "Manager",
    shortLabel: "Manager",
    tagline: "Runs projects, stock and teams. Deletes need Admin approval.",
  },
  {
    key: "engineer",
    label: "Site Engineer",
    shortLabel: "Engineer",
    tagline: "Field View only: own site, attendance, progress and material requests.",
  },
];

// Used when the visitor views the system as a user they created themselves.
export const CUSTOM_DEMO_ROLE = {
  key: "custom",
  label: "Custom user",
  shortLabel: "Custom",
  tagline: "Sees only the access granted in Control Unit.",
};

export const getDemoRole = (key) =>
  key === CUSTOM_DEMO_ROLE.key ? CUSTOM_DEMO_ROLE : DEMO_ROLES.find((r) => r.key === key) || DEMO_ROLES[0];

// The built-in demo login behind a username (demo.admin -> admin), or null for any other user.
export const builtInDemoRoleFor = (username) =>
  DEMO_ROLES.find((r) => username === `demo.${r.key}`) || null;

// Message shown on the login page after a demo session ends.
export const DEMO_NOTE_KEY = "acc-demo-note";

// Last known demo status, so the login page renders the visitor option without a jump.
export const DEMO_STATUS_KEY = "acc-demo-status";

// Fired when the server reports that the visitor's demo session is over.
export const DEMO_ENDED_EVENT = "acc-demo-ended";
