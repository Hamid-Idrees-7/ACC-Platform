import { useState, useEffect, useMemo } from "react";
import DashboardLayout from "../components/DashboardLayout";
import { usePermissions } from "../context/PermissionContext";
import { assignmentService } from "../services/assignmentService";
import { employeeService } from "../services/employeeService";
import { projectService } from "../services/projectService";
import AssignmentFormModal from "../components/AssignmentFormModal";
import { formatDate } from "../components/DatePicker";
import { rupees } from "../utils/format";
import "./Assignments.css";

const initials = (name) => (name || "?").charAt(0).toUpperCase();
const wageSuffix = (type) =>
  type === "Monthly" ? "/month · Monthly" : type === "Contract" ? "(contract) · Contract" : "/day · Daily";

function Assignments() {
  const { can } = usePermissions();
  const canAdd = can("Assignments", "Add");
  const canEdit = can("Assignments", "Edit");
  const canDelete = can("Assignments", "Delete");

  const [assignments, setAssignments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  const [formModal, setFormModal] = useState(null);
  const [confirmEnd, setConfirmEnd] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const [toast, setToast] = useState(null);
  const showToast = (text, type = "success") => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadAssignments = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await assignmentService.getAll();
      data.sort((a, b) => b.assignmentID - a.assignmentID);
      setAssignments(data);
    } catch {
      setError("Could not load assignments. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const loadRefs = async () => {
    try {
      const [emp, proj] = await Promise.all([employeeService.getAll(), projectService.getAll()]);
      setEmployees(Array.isArray(emp) ? emp : []);
      setProjects(Array.isArray(proj) ? proj : []);
    } catch {
      setEmployees([]);
      setProjects([]);
    }
  };

  useEffect(() => { loadAssignments(); loadRefs(); }, []);

  const stats = useMemo(() => ({
    total: assignments.length,
    active: assignments.filter((a) => a.status === "Active").length,
    completed: assignments.filter((a) => a.status === "Completed").length,
  }), [assignments]);

  const filtered = useMemo(() => {
    let list = [...assignments];
    if (statusFilter !== "All") list = list.filter((a) => a.status === statusFilter);
    if (projectFilter !== "All") list = list.filter((a) => String(a.projectID) === String(projectFilter));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((a) => a.employeeName?.toLowerCase().includes(q) || a.projectTitle?.toLowerCase().includes(q));
    }
    return list;
  }, [assignments, statusFilter, projectFilter, search]);

  const handleSave = async (data) => {
    if (formModal.mode === "edit") {
      await assignmentService.update(formModal.data.assignmentID, data);
      showToast("Assignment updated.");
    } else {
      await assignmentService.create(data);
      showToast("Assignment created.");
    }
    setFormModal(null);
    loadAssignments();
  };

  const handleEnd = async (id) => {
    try {
      await assignmentService.end(id);
      setConfirmEnd(null);
      showToast("Assignment ended (marked Completed).", "warn");
      loadAssignments();
    } catch {
      showToast("Could not end assignment.", "error");
    }
  };

  const handleDelete = async (id) => {
    try {
      const res = await assignmentService.delete(id);
      setConfirmDelete(null);
      if (res?.requiresApproval) {
        showToast(res.message || "Request sent to administration for approval.", res.alreadyPending ? "warn" : "success");
      } else {
        showToast("Assignment deleted.", "error");
        loadAssignments();
      }
    } catch (err) {
      setConfirmDelete(null);
      showToast(err.response?.data?.message || "Could not delete assignment.", "error");
    }
  };

  const statIcon = (name) => {
    const i = {
      cal: <><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>,
      check: <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></>,
      clock: <><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>,
    };
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{i[name]}</svg>;
  };

  return (
    <DashboardLayout title="Employee Assignments">
      {/* Stat cards */}
      <div className="asn-stats">
        <button className={`asn-stat asn-stat-total ${statusFilter === "All" ? "active" : ""}`} onClick={() => setStatusFilter("All")}>
          <div className="asn-stat-icon">{statIcon("cal")}</div>
          <div className="asn-stat-text">
            <div className="asn-stat-value">{loading ? "" : stats.total}</div>
            <div className="asn-stat-label">Total Assignments</div>
          </div>
        </button>
        <button className={`asn-stat asn-stat-active ${statusFilter === "Active" ? "active" : ""}`} onClick={() => setStatusFilter("Active")}>
          <div className="asn-stat-icon">{statIcon("check")}</div>
          <div className="asn-stat-text">
            <div className="asn-stat-value">{loading ? "" : stats.active}</div>
            <div className="asn-stat-label">Active</div>
          </div>
        </button>
        <button className={`asn-stat asn-stat-done ${statusFilter === "Completed" ? "active" : ""}`} onClick={() => setStatusFilter("Completed")}>
          <div className="asn-stat-icon">{statIcon("clock")}</div>
          <div className="asn-stat-text">
            <div className="asn-stat-value">{loading ? "" : stats.completed}</div>
            <div className="asn-stat-label">Completed</div>
          </div>
        </button>
      </div>

      {/* Toolbar */}
      <div className="asn-toolbar">
        <div className="asn-search">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          <input type="text" placeholder="Search by employee or project..." value={search} onChange={(e) => setSearch(e.target.value)} autoComplete="off" name="asn-search-box" />
        </div>
        <select className="asn-filter" value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
          <option value="All">All Projects</option>
          {projects.map((p) => <option key={p.projectID} value={p.projectID}>{p.title}</option>)}
        </select>
        {canAdd && (
          <button className="asn-add-btn" onClick={() => setFormModal({ mode: "add" })}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            New Assignment
          </button>
        )}
      </div>

      {error && <div className="asn-error">{error}</div>}

      {loading ? (
        <div className="asn-empty"><div className="asn-spinner" /><p>Loading assignments...</p></div>
      ) : filtered.length === 0 ? (
        <div className="asn-empty">
          <div className="asn-empty-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
          </div>
          <h3>{assignments.length === 0 ? "No assignments yet" : "No assignments match your filters"}</h3>
          <p>{assignments.length === 0 ? "Create your first assignment to get started." : "Try adjusting your search or filters."}</p>
        </div>
      ) : (
        <div className="asn-grid">
          {filtered.map((a) => {
            const active = a.status === "Active";
            return (
              <div key={a.assignmentID} className={`asn-card ${active ? "active" : "done"}`}>
                <div className="asn-card-head">
                  <div className="asn-avatar">{initials(a.employeeName)}</div>
                  <div className="asn-card-who">
                    <div className="asn-card-name">{a.employeeName}</div>
                    <div className="asn-card-role">{a.role}</div>
                  </div>
                  <span className={`asn-badge asn-badge-${active ? "active" : "completed"}`}>{a.status}</span>
                </div>

                <div className="asn-card-project">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18" /><path d="M5 21V7l8-4v18" /><path d="M19 21V11l-6-4" /></svg>
                  {a.projectTitle}
                </div>

                <div className="asn-wage">
                  <strong>{rupees(a.wageAmount)}</strong>
                  <span>{wageSuffix(a.wageType)}</span>
                </div>

                <div className="asn-dates">
                  <div><span>FROM</span><strong>{formatDate(a.startDate)}</strong></div>
                  <div className="asn-arrow">→</div>
                  <div><span>TO</span><strong>{a.endDate ? formatDate(a.endDate) : "Ongoing"}</strong></div>
                </div>

                <div className="asn-card-actions">
                  {canEdit && active && (
                    <button className="asn-btn-end" onClick={() => setConfirmEnd(a)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" /></svg>
                      End
                    </button>
                  )}
                  {canEdit && (
                    <button className="asn-btn-edit" onClick={() => setFormModal({ mode: "edit", data: a })}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                      Edit
                    </button>
                  )}
                  {canDelete && (
                    <button className="asn-btn-delete" onClick={() => setConfirmDelete(a)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                      Delete
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Form modal */}
      {formModal && (
        <AssignmentFormModal
          mode={formModal.mode}
          initialData={formModal.data}
          employees={employees}
          projects={projects}
          assignments={assignments}
          onClose={() => setFormModal(null)}
          onSave={handleSave}
        />
      )}

      {/* End confirm */}
      {confirmEnd && (
        <div className="asn-overlay" onClick={(e) => e.target.classList.contains("asn-overlay") && setConfirmEnd(null)}>
          <div className="asn-confirm">
            <div className="asn-confirm-icon end">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" /></svg>
            </div>
            <h3>End Assignment?</h3>
            <p>Mark <strong>{confirmEnd.employeeName}</strong>'s assignment as Completed with today's date. Attendance up to today stays counted for salary. You can reopen it anytime from Edit.</p>
            <div className="asn-confirm-actions">
              <button className="asn-confirm-cancel" onClick={() => setConfirmEnd(null)}>Cancel</button>
              <button className="asn-confirm-end" onClick={() => handleEnd(confirmEnd.assignmentID)}>End Assignment</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="asn-overlay" onClick={(e) => e.target.classList.contains("asn-overlay") && setConfirmDelete(null)}>
          <div className="asn-confirm">
            <div className="asn-confirm-icon del">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
            </div>
            <h3>Delete this assignment?</h3>
            <p><strong>{confirmDelete.employeeName} → {confirmDelete.projectTitle}</strong> will be permanently removed.</p>
            <div className="asn-confirm-actions">
              <button className="asn-confirm-cancel" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button className="asn-confirm-delete" onClick={() => handleDelete(confirmDelete.assignmentID)}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`asn-toast asn-toast-${toast.type}`}>{toast.text}</div>}
    </DashboardLayout>
  );
}

export default Assignments;
