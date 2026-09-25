// Icon for each demo role (Admin / Manager / Site Engineer, or a custom user).
function DemoRoleIcon({ role }) {
  const paths = {
    admin: (
      <>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <polyline points="9 12 11 14 15 10" />
      </>
    ),
    manager: (
      <>
        <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
      </>
    ),
    engineer: (
      <>
        <path d="M2 18a10 10 0 0 1 20 0" />
        <line x1="1" y1="18" x2="23" y2="18" />
        <path d="M10 5a2 2 0 0 1 4 0v4" />
        <path d="M8 9V6" />
        <path d="M16 9V6" />
      </>
    ),
    custom: (
      <>
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </>
    ),
  };

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[role] || paths.admin}
    </svg>
  );
}

export default DemoRoleIcon;
