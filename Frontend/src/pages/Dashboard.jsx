import { useAuth } from "../context/AuthContext";

function Dashboard() {
  const { user, logout } = useAuth();

  return (
    <div style={{ padding: "3rem", textAlign: "center" }}>
      <h1 style={{ color: "var(--color-primary)" }}>
        Welcome, {user?.fullName || "User"}!
      </h1>
      <p style={{ color: "var(--color-text-muted)", marginTop: "0.5rem" }}>
        Role: {user?.role} — You are logged in.
      </p>
      <button
        onClick={logout}
        style={{
          marginTop: "2rem",
          padding: "0.7rem 1.5rem",
          background: "var(--color-primary)",
          color: "#fff",
          border: "none",
          borderRadius: "10px",
          cursor: "pointer",
          fontWeight: 600,
        }}
      >
        Logout
      </button>
    </div>
  );
}

export default Dashboard;