import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import DashboardLayout from "../components/DashboardLayout";
import { usePermissions } from "../context/PermissionContext";
import { projectService } from "../services/projectService";
import { formatDate } from "../components/DatePicker";
import { rupees, formatQty, amountInWords } from "../utils/format";
import "./ProjectDetail.css";

const STATUSES = ["In Progress", "On Hold", "Completed", "Cancelled"];
const PHASE_STATUSES = ["Pending", "In Progress", "Completed"];
const PHASE_SUGGESTIONS = ["Swimming Pool", "Basement", "Lift Installation", "Home Theater"];
const slug = (s) => (s || "").toLowerCase().replace(/[\s/]+/g, "");

function ProgressRing({ value }) {
  const r = 32;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.max(0, Math.min(100, value)) / 100) * c;
  return (
    <svg width="84" height="84" viewBox="0 0 84 84" className="pd-ring">
      <circle cx="42" cy="42" r={r} className="pd-ring-bg" />
      <circle cx="42" cy="42" r={r} className="pd-ring-fg" style={{ strokeDasharray: c, strokeDashoffset: offset }} />
      <text x="42" y="47" textAnchor="middle" className="pd-ring-text">{value}%</text>
    </svg>
  );
}

function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = usePermissions();
  const canManage = can("Projects", "Manage");

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);

  const [addPhaseOpen, setAddPhaseOpen] = useState(false);
  const [phaseName, setPhaseName] = useState("");
  const [editPhase, setEditPhase] = useState(null); // phase object
  const [confirmPhase, setConfirmPhase] = useState(null);
  const [dragIndex, setDragIndex] = useState(null);

  const [toast, setToast] = useState(null);
  const showToast = (text, type = "success") => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3000);
  };

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await projectService.getById(id);
      setProject(data);
    } catch {
      setError("Could not load this project.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const cancelled = project?.status === "Cancelled";
  const locked = cancelled || !canManage;

  const changeStatus = async (status) => {
    setSavingStatus(true);
    try {
      const updated = await projectService.changeStatus(project.projectID, status);
      setProject(updated);
      showToast(`Status changed to ${status}.`);
    } catch {
      showToast("Could not change status.", "error");
    } finally {
      setSavingStatus(false);
    }
  };

  const addPhase = async (name) => {
    const value = (name ?? phaseName).trim();
    if (!value) return;
    try {
      await projectService.addPhase(project.projectID, value);
      setAddPhaseOpen(false);
      setPhaseName("");
      showToast("Phase added.");
      load();
    } catch {
      showToast("Could not add phase.", "error");
    }
  };

  const saveEditPhase = async () => {
    try {
      await projectService.updatePhase(editPhase.phaseID, { status: editPhase.status, progress: Number(editPhase.progress) });
      setEditPhase(null);
      showToast("Phase updated.");
      load();
    } catch {
      showToast("Could not update phase.", "error");
    }
  };

  const deletePhase = async (phaseId) => {
    try {
      await projectService.deletePhase(phaseId);
      setConfirmPhase(null);
      showToast("Phase deleted.", "error");
      load();
    } catch {
      showToast("Could not delete phase.", "error");
    }
  };

  const handleDrop = async (targetIndex) => {
    if (dragIndex === null || dragIndex === targetIndex) { setDragIndex(null); return; }
    const list = [...project.phases];
    const [moved] = list.splice(dragIndex, 1);
    list.splice(targetIndex, 0, moved);
    setProject({ ...project, phases: list });
    setDragIndex(null);
    try {
      await projectService.reorderPhases(project.projectID, list.map((p) => p.phaseID));
    } catch {
      showToast("Could not save the new order.", "error");
      load();
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Project">
        <div className="pd-empty"><div className="pd-spinner" /><p>Loading project...</p></div>
      </DashboardLayout>
    );
  }

  if (error || !project) {
    return (
      <DashboardLayout title="Project">
        <button className="pd-back" onClick={() => navigate("/dashboard/projects")}>← Back to Projects</button>
        <div className="pd-error">{error || "Project not found."}</div>
      </DashboardLayout>
    );
  }

  const f = project.financials || {};
  const phaseCounts = {
    completed: project.phases.filter((p) => p.status === "Completed").length,
    inprogress: project.phases.filter((p) => p.status === "In Progress").length,
    pending: project.phases.filter((p) => p.status === "Pending").length,
  };

  return (
    <DashboardLayout title="Project">
      <button className="pd-back" onClick={() => navigate("/dashboard/projects")}>← Back to Projects</button>

      <div className={`pd-wrap ${cancelled ? "cancelled" : ""}`}>
        {/* Header banner */}
        <div className={`pd-banner ${cancelled ? "grey" : ""}`}>
          <div className="pd-banner-left">
            <span className={`pd-badge pd-badge-${slug(project.status)}`}>{project.status}</span>
            <h2>{project.title}</h2>
            <div className="pd-banner-client">Client: <strong>{project.clientName}</strong>{project.clientPhone ? `, ${project.clientPhone}` : ""}</div>
            {project.description && <p className="pd-banner-desc">{project.description}</p>}
          </div>
          <div className="pd-banner-right"><ProgressRing value={project.overallProgress} /><span>Overall Progress</span></div>
        </div>

        {/* Status change */}
        <div className="pd-status-card">
          <div>
            <span className="pd-status-label">PROJECT STATUS</span>
            <span className={`pd-badge pd-badge-${slug(project.status)}`}>{project.status}</span>
          </div>
          <div className="pd-status-change">
            <span>Change status:</span>
            <select value={project.status} disabled={!canManage || savingStatus} onChange={(e) => changeStatus(e.target.value)}>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {cancelled && (
          <div className="pd-cancelled-note">This project is <strong>Cancelled</strong> and read-only. Change status above to reactivate.</div>
        )}

        {/* Info cards */}
        <div className="pd-info-cards">
          <div className="pd-info"><span>TYPE</span><strong>{project.projectType}</strong></div>
          <div className="pd-info"><span>AREA</span><strong>{project.areaSize}</strong></div>
          <div className="pd-info"><span>LOCATION</span><strong>{project.location}</strong></div>
          <div className="pd-info"><span>START DATE</span><strong>{project.startDate ? formatDate(project.startDate) : "—"}</strong></div>
          <div className="pd-info"><span>EXPECTED END</span><strong>{project.expectedEndDate ? formatDate(project.expectedEndDate) : "—"}</strong></div>
        </div>

        {/* Financials */}
        <div className="pd-fin-card">
          <div className="pd-fin-head">
            <span>PROJECT FINANCIALS</span>
            <span className="pd-margin">{f.marginPercent}% margin</span>
          </div>
          <div className="pd-fin-body">
            <div className="pd-fin-rows">
              <div className="pd-fin-row">
                <span>Budget (from client)</span>
                <div className="pd-fin-amt pos"><strong>+ {rupees(f.budget)}</strong><em>{amountInWords(f.budget)}</em></div>
              </div>
              <div className="pd-fin-row">
                <span>Material Cost <b className="pd-tag">ISSUED</b></span>
                <div className="pd-fin-amt neg"><strong>− {rupees(f.materialCost)}</strong><em>{amountInWords(f.materialCost)}</em></div>
              </div>
              <div className="pd-fin-row">
                <span>Labour Cost <b className="pd-tag">CONTRACT</b></span>
                <div className="pd-fin-amt neg"><strong>− {rupees(f.labourCost)}</strong><em>{amountInWords(f.labourCost)}</em></div>
              </div>
              <div className="pd-fin-row pd-fin-total">
                <span>Actual Cost</span>
                <div className="pd-fin-amt"><strong>{rupees(f.actualCost)}</strong><em>{amountInWords(f.actualCost)}</em></div>
              </div>
            </div>
            <div className={`pd-profit ${f.profit >= 0 ? "pos" : "neg"}`}>
              <span>{f.profit >= 0 ? "CONFIRMED PROFIT" : "LOSS"}</span>
              <strong>{rupees(f.profit)}</strong>
              <em>{amountInWords(f.profit)}</em>
            </div>
          </div>
          <div className="pd-fin-note">Material cost fills in as stock is issued to this project's phases. Labour cost comes from the Attendance module.</div>
        </div>

        {/* Phases + Team */}
        <div className="pd-columns">
          <div className="pd-phases">
            <div className="pd-phases-head">
              <h3>Construction Phases</h3>
              <div className="pd-phases-head-right">
                <span className="pd-count">{project.phases.length}</span>
                {canManage && !cancelled && (
                  <button className="pd-add-phase" onClick={() => setAddPhaseOpen(true)}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                    Add Phase
                  </button>
                )}
              </div>
            </div>

            {project.phases.length > 0 && (
              <div className="pd-phase-summary">
                <span className="pd-chip green">{phaseCounts.completed} Completed</span>
                <span className="pd-chip orange">{phaseCounts.inprogress} In Progress</span>
                <span className="pd-chip grey">{phaseCounts.pending} Pending</span>
              </div>
            )}

            {project.phases.length === 0 ? (
              <div className="pd-phase-empty">No phases for this project yet.</div>
            ) : (
              <div className="pd-phase-list">
                {project.phases.map((ph, i) => (
                  <div
                    key={ph.phaseID}
                    className={`pd-phase pd-phase-${slug(ph.status)} ${dragIndex === i ? "dragging" : ""}`}
                    draggable={canManage && !cancelled}
                    onDragStart={() => setDragIndex(i)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handleDrop(i)}
                  >
                    {canManage && !cancelled && (
                      <span className="pd-phase-grip" title="Drag to reorder">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" /><circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" /><circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" /></svg>
                      </span>
                    )}
                    <span className="pd-phase-order">{i + 1}</span>
                    <div className="pd-phase-main">
                      <div className="pd-phase-top">
                        <span className="pd-phase-name">{ph.name}</span>
                        <span className={`pd-phase-badge pd-phase-badge-${slug(ph.status)}`}>{ph.status}</span>
                      </div>
                      <div className="pd-phase-bar"><div className="pd-phase-bar-fill" style={{ width: `${ph.progress}%` }} /></div>
                      <div className="pd-phase-pct">{ph.progress}% complete</div>
                    </div>
                    {canManage && !cancelled && (
                      <div className="pd-phase-actions">
                        <button onClick={() => setEditPhase({ ...ph })} aria-label="Edit phase">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                        </button>
                        <button className="pd-phase-del" onClick={() => setConfirmPhase(ph)} aria-label="Delete phase">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Team (placeholder — filled by Assignments module) */}
          <div className="pd-team">
            <h3>Construction Site</h3>
            <div className="pd-team-box">
              <div className="pd-team-row"><span>SITE ENGINEER</span><div className="pd-team-empty">Not assigned</div></div>
              <div className="pd-team-row"><span>WORKERS (0)</span><div className="pd-team-empty">No workers assigned yet</div></div>
              <button className="pd-manage-team" onClick={() => navigate("/dashboard/assignments")}>Manage Team →</button>
            </div>
            <p className="pd-team-note">Team &amp; labour cost come from the Assignments module (coming next).</p>
          </div>
        </div>

        {/* Materials Used — Phase by Phase */}
        {project.materialsByPhase && project.materialsByPhase.length > 0 && (
          <div className="pd-materials">
            <h3>Materials Used — Phase by Phase</h3>
            {project.materialsByPhase.map((pm, idx) => (
              <div key={idx} className="pd-mat-phase">
                <div className="pd-mat-phase-head">
                  <span>{pm.phaseName}</span>
                  <span className="pd-mat-sub">{rupees(pm.subtotal)} <em>({amountInWords(pm.subtotal)})</em></span>
                </div>
                {pm.items.map((it, j) => (
                  <div key={j} className="pd-mat-line">
                    <div>
                      <div className="pd-mat-name">{it.materialName}</div>
                      <div className="pd-mat-qty">{formatQty(it.quantity)} {it.unit}</div>
                    </div>
                    <span className="pd-mat-amt">{rupees(it.amount)}</span>
                  </div>
                ))}
              </div>
            ))}
            <div className="pd-mat-grand">
              <span>Grand Total — All Materials</span>
              <div className="pd-mat-grand-amt">
                <strong>{rupees(project.financials.materialCost)}</strong>
                <em>({amountInWords(project.financials.materialCost)})</em>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add phase modal */}
      {addPhaseOpen && (
        <div className="pd-overlay" onClick={(e) => e.target.classList.contains("pd-overlay") && setAddPhaseOpen(false)}>
          <div className="pd-modal">
            <h3>Add New Phase</h3>
            <p className="pd-modal-sub">For luxury homes you can add phases like Swimming Pool, Basement, Lift, Home Theater, etc.</p>
            <label className="pd-modal-label">Phase Name</label>
            <input type="text" maxLength={100} value={phaseName} onChange={(e) => setPhaseName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addPhase()} placeholder="e.g. Swimming Pool" autoFocus />
            <div className="pd-suggestions">
              {PHASE_SUGGESTIONS.map((s) => <button key={s} onClick={() => setPhaseName(s)}>{s}</button>)}
            </div>
            <div className="pd-modal-actions">
              <button className="pd-modal-cancel" onClick={() => { setAddPhaseOpen(false); setPhaseName(""); }}>Cancel</button>
              <button className="pd-modal-save" onClick={() => addPhase()}>Add Phase</button>
            </div>
          </div>
        </div>
      )}

      {/* Update phase modal */}
      {editPhase && (
        <div className="pd-overlay" onClick={(e) => e.target.classList.contains("pd-overlay") && setEditPhase(null)}>
          <div className="pd-modal">
            <h3>Update Phase</h3>
            <p className="pd-modal-sub">{editPhase.name}</p>
            <label className="pd-modal-label">Status</label>
            <select value={editPhase.status} onChange={(e) => setEditPhase({ ...editPhase, status: e.target.value })}>
              {PHASE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <label className="pd-modal-label">Progress (%)</label>
            <input type="range" min="0" max="100" value={editPhase.progress} onChange={(e) => setEditPhase({ ...editPhase, progress: e.target.value })} className="pd-range" />
            <div className="pd-range-val">{editPhase.progress}%</div>
            <div className="pd-modal-actions">
              <button className="pd-modal-cancel" onClick={() => setEditPhase(null)}>Cancel</button>
              <button className="pd-modal-save" onClick={saveEditPhase}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete phase confirm */}
      {confirmPhase && (
        <div className="pd-overlay" onClick={(e) => e.target.classList.contains("pd-overlay") && setConfirmPhase(null)}>
          <div className="pd-confirm">
            <h3>Delete this phase?</h3>
            <p><strong>{confirmPhase.name}</strong> will be removed from this project.</p>
            <div className="pd-modal-actions">
              <button className="pd-modal-cancel" onClick={() => setConfirmPhase(null)}>Cancel</button>
              <button className="pd-confirm-del" onClick={() => deletePhase(confirmPhase.phaseID)}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`pd-toast pd-toast-${toast.type}`}>{toast.text}</div>}
    </DashboardLayout>
  );
}

export default ProjectDetail;
