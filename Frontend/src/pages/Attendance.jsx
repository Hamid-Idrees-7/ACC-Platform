import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../components/DashboardLayout";
import { attendanceService } from "../services/attendanceService";
import "./Attendance.css";

// Groups are shown in this order; each has its own accent colour.
const STATUS_GROUPS = [
  { key: "In Progress", cls: "prog" },
  { key: "On Hold", cls: "hold" },
  { key: "Completed", cls: "done" },
  { key: "Cancelled", cls: "cancel" },
];

const slug = (s) => (s || "").toLowerCase().replace(/[\s/]+/g, "");

function Attendance() {
  const navigate = useNavigate();
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const data = await attendanceService.getCards();
        setCards(data);
      } catch {
        setError("Could not load attendance.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const openProject = (p) => navigate(`/dashboard/attendance/${p.projectID}`);

  const actionLabel = (p) => {
    if (p.status === "Cancelled") return "View record →";
    if (p.workersCount === 0) return "View →";
    return "Mark attendance →";
  };

  const grouped = STATUS_GROUPS
    .map((g) => ({ ...g, items: cards.filter((c) => c.status === g.key) }))
    .filter((g) => g.items.length > 0);

  return (
    <DashboardLayout title="Attendance">
      {loading ? (
        <div className="att-empty"><div className="att-spinner" /><p>Loading projects...</p></div>
      ) : error ? (
        <div className="att-error">{error}</div>
      ) : cards.length === 0 ? (
        <div className="att-empty">
          <div className="att-empty-icon">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
          </div>
          <h3>No projects yet</h3>
          <p>Create a project and assign workers to start marking attendance.</p>
        </div>
      ) : (
        grouped.map((g) => (
          <div key={g.key} className="att-group">
            <span className={`att-group-pill att-group-${g.cls}`}>
              <i /> {g.key} <b>{g.items.length}</b>
            </span>
            <div className="att-grid">
              {g.items.map((p) => (
                <div
                  key={p.projectID}
                  className={`att-card ${p.status === "Cancelled" ? "cancelled" : ""}`}
                  onClick={() => openProject(p)}
                >
                  <h3 className="att-card-title">{p.title}</h3>
                  <div className="att-card-loc">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                    {p.location || "—"}
                  </div>
                  <div className="att-card-meta">
                    <div>
                      <span>SITE INCHARGE</span>
                      <strong className={p.siteIncharge === "Not assigned" ? "muted" : ""}>{p.siteIncharge}</strong>
                    </div>
                    <div className="att-card-workers">
                      <span>WORKERS</span>
                      <strong>{p.workersCount}</strong>
                    </div>
                  </div>
                  <span className={`att-card-action ${p.workersCount === 0 || p.status === "Cancelled" ? "muted" : ""}`}>
                    {actionLabel(p)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </DashboardLayout>
  );
}

export default Attendance;
