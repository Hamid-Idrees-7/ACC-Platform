import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../components/DashboardLayout";
import { usePermissions } from "../context/PermissionContext";
import { projectService } from "../services/projectService";
import { clientService } from "../services/clientService";
import ProjectFormModal from "../components/ProjectFormModal";
import { formatDate } from "../components/DatePicker";
import { rupeesShort, rupeesPK, amountInWords } from "../utils/format";
import "./ProjectManagement.css";

const STATUSES = ["In Progress", "On Hold", "Completed", "Cancelled"];
const slug = (s) => (s || "").toLowerCase().replace(/\s+/g, "");

function ProjectManagement() {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const canAdd = can("Projects", "Add");
  const canEdit = can("Projects", "Edit");
  const canDelete = can("Projects", "Delete");

  const [projects, setProjects] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [search, setSearch] = useState("");
  const [clientFilter, setClientFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  // Modals
  const [formModal, setFormModal] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  // Toast
  const [toast, setToast] = useState(null);
  const showToast = (text, type = "success") => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3000);
  };

  // The first load shows the spinner. Reloads after a change ({ quiet: true }) keep the
  // page on screen, so it never jumps back to the top.
  const loadProjects = async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    setError("");
    try {
      const data = await projectService.getAll();
      data.sort((a, b) => b.projectID - a.projectID);
      setProjects(data);
    } catch {
      if (quiet) showToast("Could not refresh. Please reload the page.", "error");
      else setError("Could not load projects. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const loadClients = async () => {
    try {
      const data = await clientService.getAll();
      setClients(Array.isArray(data) ? data : []);
    } catch {
      setClients([]);
    }
  };

  useEffect(() => { loadProjects(); loadClients(); }, []);

  const stats = useMemo(() => ({
    total: projects.length,
    inProgress: projects.filter((p) => p.status === "In Progress").length,
    completed: projects.filter((p) => p.status === "Completed").length,
    activeBudget: projects
      .filter((p) => p.status === "In Progress")
      .reduce((sum, p) => sum + (Number(p.budget) || 0), 0),
  }), [projects]);

  const filtered = useMemo(() => {
    let list = [...projects];
    if (statusFilter !== "All") list = list.filter((p) => p.status === statusFilter);
    if (clientFilter !== "All") list = list.filter((p) => String(p.clientID) === String(clientFilter));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.title?.toLowerCase().includes(q) || p.location?.toLowerCase().includes(q));
    }
    return list;
  }, [projects, statusFilter, clientFilter, search]);

  // ---- Actions ----
  const handleSave = async (data) => {
    if (formModal.mode === "edit") {
      await projectService.update(formModal.data.projectID, data);
      showToast("Project updated successfully.");
    } else {
      await projectService.create(data);
      showToast("Project created successfully.");
    }
    setFormModal(null);
    loadProjects({ quiet: true });
  };

  const handleDelete = async (id) => {
    try {
      const res = await projectService.delete(id);
      setConfirmDelete(null);
      if (res?.requiresApproval) {
        showToast(res.message || "Request sent to administration for approval.", res.alreadyPending ? "warn" : "success");
      } else {
        showToast("Project deleted.", "error");
        loadProjects({ quiet: true });
      }
    } catch (err) {
      showToast(err.response?.data?.message || "Could not delete project.", "error");
    }
  };

  const dateRange = (s, e) => {
    if (s && e) return `${formatDate(s)} → ${formatDate(e)}`;
    if (s) return `From ${formatDate(s)}`;
    if (e) return `Until ${formatDate(e)}`;
    return "No dates set";
  };

  const statIcon = (name) => {
    const i = {
      building: <><path d="M3 21h18" /><path d="M5 21V7l8-4v18" /><path d="M19 21V11l-6-4" /></>,
      clock: <><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>,
      check: <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></>,
      dollar: <><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></>,
    };
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{i[name]}</svg>;
  };

  return (
    <DashboardLayout title="Project Management">
      {/* Stat cards */}
      <div className="proj-stats">
        <button className={`proj-stat proj-stat-total ${statusFilter === "All" ? "active" : ""}`} onClick={() => setStatusFilter("All")}>
          <div className="proj-stat-icon">{statIcon("building")}</div>
          <div className="proj-stat-text">
            <div className="proj-stat-value">{loading ? "" : stats.total}</div>
            <div className="proj-stat-label">Total Projects</div>
          </div>
        </button>

        <button className={`proj-stat proj-stat-progress ${statusFilter === "In Progress" ? "active" : ""}`} onClick={() => setStatusFilter("In Progress")}>
          <div className="proj-stat-icon">{statIcon("clock")}</div>
          <div className="proj-stat-text">
            <div className="proj-stat-value">{loading ? "" : stats.inProgress}</div>
            <div className="proj-stat-label">In Progress</div>
          </div>
        </button>

        <button className={`proj-stat proj-stat-done ${statusFilter === "Completed" ? "active" : ""}`} onClick={() => setStatusFilter("Completed")}>
          <div className="proj-stat-icon">{statIcon("check")}</div>
          <div className="proj-stat-text">
            <div className="proj-stat-value">{loading ? "" : stats.completed}</div>
            <div className="proj-stat-label">Completed</div>
          </div>
        </button>

        <div className="proj-stat proj-stat-budget no-click">
          <div className="proj-stat-icon">{statIcon("dollar")}</div>
          <div className="proj-stat-text">
            <div className="proj-stat-money">{loading ? "" : rupeesShort(stats.activeBudget)}</div>
            <div className="proj-stat-label">Active Budget</div>
            {!loading && (
              <div className="proj-stat-exact">{rupeesPK(stats.activeBudget)} <span className="proj-stat-words">({amountInWords(stats.activeBudget)})</span></div>
            )}
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="proj-toolbar">
        <div className="proj-search">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          <input type="text" placeholder="Search by project title or location..." value={search} onChange={(e) => setSearch(e.target.value)} autoComplete="off" name="proj-search-box" />
        </div>
        <select className="proj-filter" value={clientFilter} onChange={(e) => setClientFilter(e.target.value)}>
          <option value="All">All Clients</option>
          {clients.map((c) => <option key={c.clientID} value={c.clientID}>{c.fullName}</option>)}
        </select>
        <select className="proj-filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="All">All Status</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        {canAdd && (
          <button className="proj-add-btn" onClick={() => setFormModal({ mode: "add" })}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            Add Project
          </button>
        )}
      </div>

      {error && <div className="proj-error">{error}</div>}

      {/* Cards grid */}
      {loading ? (
        <div className="proj-empty"><div className="proj-spinner" /><p>Loading projects...</p></div>
      ) : filtered.length === 0 ? (
        <div className="proj-empty">
          <div className="proj-empty-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18" /><path d="M5 21V7l8-4v18" /><path d="M19 21V11l-6-4" /></svg>
          </div>
          <h3>{projects.length === 0 ? "No projects yet" : "No projects match your filters"}</h3>
          <p>{projects.length === 0 ? "Create your first project to get started." : "Try adjusting your search or filters."}</p>
        </div>
      ) : (
        <div className="proj-grid">
          {filtered.map((p) => (
            <div key={p.projectID} className="proj-card">
              <div className="proj-card-top">
                <span className={`proj-badge proj-badge-${slug(p.status)}`}>{p.status}</span>
                <span className="proj-type">{p.projectType}</span>
              </div>

              <h4 className="proj-card-title">{p.title}</h4>

              <div className="proj-card-info">
                <div className="proj-card-row">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                  {p.clientName}
                </div>
                <div className="proj-card-row">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
                  {p.areaSize}
                </div>
                <div className="proj-card-row">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                  {p.location}
                </div>
                <div className="proj-card-row proj-card-budget">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
                  <span>{rupeesShort(p.budget)} <em>({rupeesPK(p.budget)})</em></span>
                </div>
                <div className="proj-card-row">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                  {dateRange(p.startDate, p.expectedEndDate)}
                </div>
              </div>

              <div className="proj-card-actions">
                <button className="proj-btn-view" onClick={() => navigate(`/dashboard/projects/${p.projectID}`)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                  View
                </button>
                {canEdit && (
                  <button className="proj-btn-edit" onClick={() => setFormModal({ mode: "edit", data: p })}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                    Edit
                  </button>
                )}
                {canDelete && (
                  <button className="proj-btn-delete" onClick={() => setConfirmDelete(p)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit modal */}
      {formModal && (
        <ProjectFormModal
          mode={formModal.mode}
          initialData={formModal.data}
          clients={clients}
          existingTypes={[...new Set(projects.map((p) => p.projectType).filter(Boolean))].sort()}
          onClose={() => setFormModal(null)}
          onSave={handleSave}
        />
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="proj-overlay" onClick={(e) => e.target.classList.contains("proj-overlay") && setConfirmDelete(null)}>
          <div className="proj-confirm">
            <div className="proj-confirm-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
            </div>
            <h3>Delete this project?</h3>
            <p><strong>{confirmDelete.title}</strong> and all its phases will be permanently deleted. This cannot be undone.</p>
            <div className="proj-confirm-actions">
              <button className="proj-confirm-cancel" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button className="proj-confirm-delete" onClick={() => handleDelete(confirmDelete.projectID)}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && <div className={`proj-toast proj-toast-${toast.type}`}>{toast.text}</div>}
    </DashboardLayout>
  );
}

export default ProjectManagement;
