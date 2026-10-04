import { useState, useRef } from "react";
import DashboardLayout from "../components/DashboardLayout";
import { usePermissions } from "../context/PermissionContext";
import { useCompany } from "../context/CompanyContext";
import { offDayOf } from "../config/companyConfig";
import { fieldService } from "../services/fieldService";
import { formatQty, numberInWords } from "../utils/format";
import { formatDateShort, toISODate } from "../utils/dates";
import "./FieldView.css";
import { useLiveRefresh } from "../hooks/useLive";
import ModalOverlay from "../components/ModalOverlay";
import { useUnsavedChanges, leaveSafely } from "../hooks/useUnsavedChanges";
import { SkeletonPage } from "../components/Skeleton";
import { useLoader } from "../hooks/useLoader";
import { useToast } from "../components/Toast";

const prettyToday = () => formatDateShort(new Date());
const fmtDate = (d) => formatDateShort(d);

const todayISO = () => {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
};

const marksFromSheet = (sheet) => {
  const saved = {};
  [...(sheet.monthlyStaff || []), ...(sheet.dailyWorkers || [])].forEach((w) => {
    if (w.status) saved[w.assignmentID] = w.status;
  });
  return saved;
};

const sameMarks = (a, b) => {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].every((k) => (a[k] || null) === (b[k] || null));
};

function FieldView() {
  const { can } = usePermissions();
  const canManage = can("Field", "Manage");
  // Is today a weekly off day or a holiday? (Settings > Calendar)
  const { calendar } = useCompany();
  const offToday = offDayOf(calendar, todayISO());

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [active, setActive] = useState(null);     // { projectID, title }
  const [siteTab, setSiteTab] = useState("overview"); // overview | attendance | progress | requests
  const [sheet, setSheet] = useState(null);
  const [siteInfo, setSiteInfo] = useState(null);
  const [phases, setPhases] = useState([]);
  const [myRequests, setMyRequests] = useState([]);
  const [sheetLoading, setSheetLoading] = useState(false);
  const [marks, setMarks] = useState({});         // assignmentID to Present | Absent
  const [busy, setBusy] = useState(false);
  const [savingPhase, setSavingPhase] = useState(null);
  const [reqModal, setReqModal] = useState(false);
  const [reqOptions, setReqOptions] = useState(null);
  const [reqForm, setReqForm] = useState({ materialID: "", quantity: "", phaseID: "", note: "" });
  const [reqBusy, setReqBusy] = useState(false);
  const [toast, showToast] = useToast(2600);

  // The first load shows the loading skeleton; quiet reloads after a change keep the page where it is.
  const loadSite = async ({ quiet = false, silent = false } = {}) => {
    if (!quiet) setLoading(true);
    try {
      setData(await fieldService.getMySite());
      setError(false);
    } catch {
      if (quiet && !silent) showToast("Could not refresh. Please reload the page.", "error");
      else setError(true);
    } finally {
      setLoading(false);
    }
  };
  useLoader(() => loadSite());

  useLiveRefresh(["assignments", "attendance", "projects", "material-requests", "calendar"], () => loadSite({ quiet: true, silent: true }));

  // The site the engineer opened last; answers for any other site are ignored.
  const openSite = useRef(null);

  const refreshOpenSite = async () => {
    if (!active) return;
    const projectID = active.projectID;
    try {
      const [ph, reqs] = await Promise.all([fieldService.getPhases(projectID), fieldService.getMyRequests()]);
      if (openSite.current !== projectID) return;
      setPhases(ph || []);
      setMyRequests(reqs || []);
    } catch {
      return;
    }
  };
  useLiveRefresh(["projects", "material-requests"], refreshOpenSite);

  const openSheet = async (project) => {
    openSite.current = project.projectID;
    setActive({ projectID: project.projectID, title: project.title });
    setSiteTab("overview");
    setSheetLoading(true);
    setSheet(null);
    setSiteInfo(null);
    setPhases([]);
    try {
      const [s, ph, reqs, info] = await Promise.all([
        fieldService.getSheet(project.projectID, todayISO()),
        fieldService.getPhases(project.projectID).catch(() => []),
        fieldService.getMyRequests().catch(() => []),
        fieldService.getSiteInfo(project.projectID).catch(() => null),
      ]);
      if (openSite.current !== project.projectID) return;   // another site was opened meanwhile
      setSheet(s);
      setPhases(ph || []);
      setMyRequests(reqs || []);
      setSiteInfo(info);
      const initial = {};
      [...(s.monthlyStaff || []), ...(s.dailyWorkers || [])].forEach((w) => {
        if (w.status) initial[w.assignmentID] = w.status;
      });
      setMarks(initial);
    } catch {
      if (openSite.current !== project.projectID) return;
      showToast("Could not open this site.", "error");
      openSite.current = null;
      setActive(null);
    } finally {
      if (openSite.current === project.projectID) setSheetLoading(false);
    }
  };

  const backToList = () => {
    openSite.current = null;
    setActive(null); setSheet(null); setSiteInfo(null); setPhases([]); setMarks({}); setSiteTab("overview");
  };

  const marksDirty = !!sheet && sameMarks(marks, marksFromSheet(sheet)) === false;
  useUnsavedChanges(marksDirty);

  const setMark = (assignmentID, status) => {
    setMarks((m) => ({ ...m, [assignmentID]: m[assignmentID] === status ? undefined : status }));
  };

  const saveMarks = async () => {
    const entries = Object.entries(marks)
      .filter(([, status]) => status === "Present" || status === "Absent")
      .map(([assignmentID, status]) => ({ assignmentID: Number(assignmentID), status }));

    if (entries.length === 0) { showToast("Mark at least one worker first.", "error"); return; }

    setBusy(true);
    try {
      // Saved for the day the sheet shows, even if midnight passed while marking
      const day = sheet?.date ? toISODate(sheet.date) : todayISO();
      const updated = await fieldService.markAttendance(active.projectID, { date: day, entries });
      setSheet(updated);
      showToast("Attendance saved.");
      loadSite({ quiet: true });   // refresh the card counts
    } catch (err) {
      showToast(err.response?.data?.message || "Could not save attendance.", "error");
    } finally {
      setBusy(false);
    }
  };

  const setPhaseProgress = async (phaseID, value) => {
    setSavingPhase(phaseID);
    try {
      const updated = await fieldService.updateProgress(active.projectID, phaseID, value);
      setPhases(updated || []);
      showToast("Progress updated.");
      loadSite({ quiet: true });   // refresh the overall progress on the site cards
    } catch {
      showToast("Could not update progress.", "error");
    } finally {
      setSavingPhase(null);
    }
  };

  const openRequestModal = async () => {
    setReqModal(true);
    setReqOptions(null);
    setReqForm({ materialID: "", quantity: "", phaseID: "", note: "" });
    try {
      setReqOptions(await fieldService.getRequestOptions(active.projectID));
    } catch {
      showToast("Could not load materials.", "error");
      setReqModal(false);
    }
  };

  const submitRequest = async () => {
    if (!reqForm.materialID || !(Number(reqForm.quantity) > 0)) {
      showToast("Pick a material and a quantity.", "error");
      return;
    }
    setReqBusy(true);
    try {
      await fieldService.createRequest(active.projectID, {
        materialID: Number(reqForm.materialID),
        phaseID: reqForm.phaseID ? Number(reqForm.phaseID) : null,
        quantity: Number(reqForm.quantity),
        note: reqForm.note.trim() || null,
      });
      showToast("Request sent for approval.");
      setReqModal(false);
      const reqs = await fieldService.getMyRequests().catch(() => myRequests);
      setMyRequests(reqs || []);
    } catch (err) {
      showToast(err.response?.data?.message || "Could not send the request.", "error");
    } finally {
      setReqBusy(false);
    }
  };

  const deleteReq = async (requestID) => {
    setBusy(true);
    try {
      await fieldService.deleteRequest(requestID);
      showToast("Request cancelled.", "warn");
      const reqs = await fieldService.getMyRequests().catch(() => myRequests);
      setMyRequests(reqs || []);
    } catch (err) {
      showToast(err.response?.data?.message || "Could not cancel.", "error");
    } finally {
      setBusy(false);
    }
  };

  // Not a field user (eg an admin with no linked employee)
  const notFieldUser = data && data.isFieldUser === false;

  const renderWorkerRow = (w) => {
    const disabled = !w.onSiteThisDate || !canManage || sheet.isReadOnly;
    const mark = marks[w.assignmentID];
    return (
      <div key={w.assignmentID} className={`fv-worker ${disabled ? "off" : ""}`}>
        <div className="fv-worker-info">
          <div className="fv-worker-avatar">{(w.employeeName || "?").charAt(0).toUpperCase()}</div>
          <div>
            <div className="fv-worker-name">{w.employeeName}</div>
            <div className="fv-worker-role">{w.role}{w.wageType === "Daily" ? " · Daily" : w.wageType === "Monthly" ? " · Monthly" : ""}</div>
          </div>
        </div>
        {!w.onSiteThisDate ? (
          <span className="fv-off-tag">Not on site today</span>
        ) : (
          <div className="fv-mark-btns">
            <button
              className={`fv-mark present ${mark === "Present" ? "on" : ""}`}
              onClick={() => setMark(w.assignmentID, "Present")}
              disabled={disabled}
            >P</button>
            <button
              className={`fv-mark absent ${mark === "Absent" ? "on" : ""}`}
              onClick={() => setMark(w.assignmentID, "Absent")}
              disabled={disabled}
            >A</button>
          </div>
        )}
      </div>
    );
  };

  return (
    <DashboardLayout title="Field View — My Site">
      {loading ? (
        <SkeletonPage stats={3} rows={4} />
      ) : error ? (
        <div className="fv-empty"><h3>Could not load your sites</h3><p>Check your connection and refresh the page to try again.</p></div>
      ) : notFieldUser ? (
        <div className="fv-empty">
          <div className="fv-empty-ic">
            <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M2 18a10 10 0 0 1 20 0" /><line x1="1" y1="18" x2="23" y2="18" /><path d="M10 5a2 2 0 0 1 4 0v4" /></svg>
          </div>
          <h3>This account isn't a field user</h3>
          <p>Field View is for site engineers. An admin can link this login to an employee (Users → Linked Employee), and that employee's assigned site will appear here.</p>
        </div>
      ) : active ? (

        /* Attendance sheet for one site */
        <div className="fv-sheet-wrap">
          <button className="fv-back" onClick={() => leaveSafely(backToList)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
            My Sites
          </button>

          {sheetLoading ? (
            <div className="fv-empty"><div className="fv-spinner" /></div>
          ) : sheet ? (
            <>
              <div className="fv-sheet-head">
                <div>
                  <h2>{sheet.projectTitle}</h2>
                  <span className="fv-sheet-date">{sheet.location} · {prettyToday()}</span>
                </div>
                {siteTab === "attendance" && (
                  <div className="fv-sheet-counts">
                    <span className="fv-count present">{sheet.presentCount} P</span>
                    <span className="fv-count absent">{sheet.absentCount} A</span>
                    <span className="fv-count unmarked">{sheet.unmarkedCount} left</span>
                  </div>
                )}
              </div>

              <div className="fv-tabs">
                <button className={`fv-tab ${siteTab === "overview" ? "active" : ""}`} onClick={() => setSiteTab("overview")}>Overview</button>
                <button className={`fv-tab ${siteTab === "attendance" ? "active" : ""}`} onClick={() => setSiteTab("attendance")}>Attendance</button>
                <button className={`fv-tab ${siteTab === "progress" ? "active" : ""}`} onClick={() => setSiteTab("progress")}>Progress</button>
                <button className={`fv-tab ${siteTab === "requests" ? "active" : ""}`} onClick={() => setSiteTab("requests")}>Requests</button>
              </div>

              {siteTab === "overview" ? (
                <>
                  {!siteInfo ? (
                    <div className="fv-empty"><div className="fv-spinner" /></div>
                  ) : (
                    <div className="fv-overview">
                      <div className="fv-ov-progress">
                        <div className="fv-ov-progress-top">
                          <span>Overall Progress</span>
                          <span className="fv-ov-pct">{siteInfo.overallProgress}%</span>
                        </div>
                        <div className="fv-bar"><span style={{ width: `${siteInfo.overallProgress}%` }} /></div>
                        <div className="fv-ov-sub">{siteInfo.completedPhases} of {siteInfo.totalPhases} phases done · {siteInfo.teamSize} on the team</div>
                      </div>

                      <div className="fv-ov-grid">
                        <div className="fv-ov-item"><span className="fv-ov-lbl">Status</span><span className={`fv-status ${siteInfo.status.replace(/\s/g, "").toLowerCase()}`}>{siteInfo.status}</span></div>
                        <div className="fv-ov-item"><span className="fv-ov-lbl">Client</span><strong>{siteInfo.clientName || "—"}</strong></div>
                        <div className="fv-ov-item"><span className="fv-ov-lbl">Type</span><strong>{siteInfo.projectType || "—"}</strong></div>
                        <div className="fv-ov-item"><span className="fv-ov-lbl">Area</span><strong>{siteInfo.areaSize || "—"}</strong></div>
                        <div className="fv-ov-item"><span className="fv-ov-lbl">Location</span><strong>{siteInfo.location || "—"}</strong></div>
                        <div className="fv-ov-item"><span className="fv-ov-lbl">Start</span><strong>{fmtDate(siteInfo.startDate) || "—"}</strong></div>
                        <div className="fv-ov-item"><span className="fv-ov-lbl">Expected End</span><strong>{fmtDate(siteInfo.expectedEndDate) || "—"}</strong></div>
                      </div>

                      {siteInfo.description && (
                        <div className="fv-ov-desc"><span className="fv-ov-lbl">Description</span><p>{siteInfo.description}</p></div>
                      )}
                    </div>
                  )}
                </>
              ) : siteTab === "attendance" ? (
                <>
                  {sheet.isReadOnly && <div className="fv-readonly">This project is cancelled — attendance is read-only.</div>}
                  {!canManage && !sheet.isReadOnly && <div className="fv-readonly">You have view access only — ask an admin for "Mark Attendance".</div>}
                  {offToday && !sheet.isReadOnly && (
                    <div className="fv-offday">
                      {offToday.kind === "holiday" ? `Today is a company holiday (${offToday.name}).` : `Today is the weekly off (${offToday.name}).`}
                      {" "}Mark only the workers who came in.
                    </div>
                  )}

                  {[...(sheet.monthlyStaff || []), ...(sheet.dailyWorkers || [])].length === 0 ? (
                    <div className="fv-empty"><p>No workers assigned to this site.</p></div>
                  ) : (
                    <div className="fv-workers">
                      {(sheet.monthlyStaff || []).map(renderWorkerRow)}
                      {(sheet.dailyWorkers || []).map(renderWorkerRow)}
                    </div>
                  )}

                  {canManage && !sheet.isReadOnly && (
                    <div className="fv-save-bar">
                      <button className="fv-save" onClick={saveMarks} disabled={busy}>{busy ? "Saving..." : "Save Attendance"}</button>
                    </div>
                  )}
                </>
              ) : siteTab === "progress" ? (
                <>
                  {!canManage && <div className="fv-readonly">View only — ask an admin for "Update Progress" to edit phases.</div>}
                  {sheet.isReadOnly && <div className="fv-readonly">This project is cancelled — progress is read-only.</div>}

                  {phases.length === 0 ? (
                    <div className="fv-empty"><p>No phases set up for this site yet.</p></div>
                  ) : (
                    <div className="fv-phases">
                      {[...phases].sort((a, b) => a.orderNo - b.orderNo).map((ph) => (
                        <div className="fv-phase" key={ph.phaseID}>
                          <div className="fv-phase-top">
                            <span className="fv-phase-name">{ph.name}</span>
                            <span className={`fv-phase-status ${ph.status.replace(/\s/g, "").toLowerCase()}`}>{ph.status}</span>
                          </div>
                          <div className="fv-bar"><span style={{ width: `${ph.progress}%` }} /></div>
                          <div className="fv-phase-foot">
                            <span className="fv-phase-pct">{ph.progress}%</span>
                            {canManage && !sheet.isReadOnly && (
                              <div className="fv-presets">
                                {[0, 25, 50, 75, 100].map((v) => (
                                  <button
                                    key={v}
                                    className={`fv-preset ${ph.progress === v ? "on" : ""}`}
                                    disabled={savingPhase === ph.phaseID}
                                    onClick={() => setPhaseProgress(ph.phaseID, v)}
                                  >{v}</button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="fv-req-bar">
                    <span className="fv-req-title">Material requests for this site</span>
                    {canManage && !sheet.isReadOnly && (
                      <button className="fv-req-new" onClick={openRequestModal}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                        New Request
                      </button>
                    )}
                  </div>
                  {!canManage && <div className="fv-readonly">View only — ask an admin for "Request Material" to raise requests.</div>}

                  {myRequests.filter((r) => r.projectID === active.projectID).length === 0 ? (
                    <div className="fv-empty"><p>No material requests for this site yet.</p></div>
                  ) : (
                    <div className="fv-reqs">
                      {myRequests.filter((r) => r.projectID === active.projectID).map((r) => (
                        <div className="fv-req" key={r.requestID}>
                          <div className="fv-req-top">
                            <span className="fv-req-mat">{formatQty(r.quantity)} {r.unit} · {r.materialName}</span>
                            <span className={`fv-req-status ${r.status.toLowerCase()}`}>{r.status}</span>
                          </div>
                          <div className="fv-req-meta">
                            {r.phaseName && <span>{r.phaseName}</span>}
                            <span>{fmtDate(r.createdAt)}</span>
                          </div>
                          {r.note && <div className="fv-req-note">"{r.note}"</div>}
                          {r.status === "Rejected" && r.resolveNote && <div className="fv-req-reject">Reason: {r.resolveNote}</div>}
                          {r.status === "Pending" && canManage && (
                            <div className="fv-req-actions">
                              <button className="fv-req-cancel" onClick={() => deleteReq(r.requestID)} disabled={busy}>Cancel request</button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          ) : null}
        </div>
      ) : (
        
        /* My sites list */
        <>
          <div className="fv-hello">
            <h2>Here's your work, {data.employeeName?.split(" ")[0] || "Engineer"}</h2>
            <p>{data.designation || "Site Engineer"} · {prettyToday()}</p>
          </div>

          {(!data.projects || data.projects.length === 0) ? (
            <div className="fv-empty">
              <h3>No site assigned yet</h3>
              <p>Once you're assigned to a project, it will show up here for updates.</p>
            </div>
          ) : (
            <div className="fv-sites">
              {data.projects.map((p) => (
                <button key={p.projectID} className={`fv-site ${p.status.replace(/\s/g, "").toLowerCase()}`} onClick={() => openSheet(p)}>
                  <div className="fv-site-head">
                    <h3>{p.title}</h3>
                    <span className={`fv-status ${p.status.replace(/\s/g, "").toLowerCase()}`}>{p.status}</span>
                  </div>
                  {p.location && (
                    <div className="fv-site-loc">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                      {p.location}
                    </div>
                  )}

                  <div className="fv-progress">
                    <div className="fv-progress-top"><span>Progress</span><span className="fv-progress-pct">{p.progress}%</span></div>
                    <div className="fv-bar"><span style={{ width: `${p.progress}%` }} /></div>
                  </div>

                  <div className="fv-site-foot">
                    <span className="fv-workers-count">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>
                      {p.workersCount} workers
                    </span>
                    <span className="fv-today">
                      <span className="fv-dot present" />{p.todayPresent}
                      <span className="fv-dot absent" />{p.todayAbsent}
                      {offToday
                        ? <span className="fv-today-off">{offToday.kind === "holiday" ? offToday.name : "Weekly off"}</span>
                        : p.todayUnmarked > 0 && <span className="fv-today-left">{p.todayUnmarked} to mark</span>}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {reqModal && (
        <ModalOverlay className="fv-overlay" onClose={() => setReqModal(false)}>
          <div className="fv-modal">
            <h3>Request Material</h3>
            <p className="fv-modal-sub">This goes to the office for approval before stock is issued.</p>
            {!reqOptions ? (
              <div className="fv-empty"><div className="fv-spinner" /></div>
            ) : (
              <>
                <label className="fv-label">Material <span>*</span></label>
                <select value={reqForm.materialID} onChange={(e) => setReqForm((f) => ({ ...f, materialID: e.target.value }))}>
                  <option value="">Select material…</option>
                  {reqOptions.materials.map((m) => (
                    <option key={m.materialID} value={m.materialID}>{m.name} ({formatQty(m.currentStock)} {m.unit} in stock)</option>
                  ))}
                </select>

                <label className="fv-label">Quantity <span>*</span></label>
                <input type="number" min="0" step="any" value={reqForm.quantity} onChange={(e) => setReqForm((f) => ({ ...f, quantity: e.target.value }))} placeholder="How much do you need?" />
                {Number(reqForm.quantity) > 0 && (() => {
                  const unit = reqOptions.materials.find((m) => String(m.materialID) === reqForm.materialID)?.unit || "";
                  const words = Number.isInteger(Number(reqForm.quantity)) ? ` (${numberInWords(reqForm.quantity)})` : "";
                  return <div className="fv-qty-words">= {formatQty(reqForm.quantity)}{unit ? ` ${unit}` : ""}{words}</div>;
                })()}

                <label className="fv-label">Phase (optional)</label>
                <select value={reqForm.phaseID} onChange={(e) => setReqForm((f) => ({ ...f, phaseID: e.target.value }))}>
                  <option value="">— None —</option>
                  {reqOptions.phases.map((p) => <option key={p.phaseID} value={p.phaseID}>{p.name}</option>)}
                </select>

                <label className="fv-label">Note (optional)</label>
                <input type="text" maxLength={255} value={reqForm.note} onChange={(e) => setReqForm((f) => ({ ...f, note: e.target.value }))} placeholder="Your message" />

                <div className="fv-modal-actions">
                  <button className="fv-modal-cancel" data-close onClick={() => setReqModal(false)} disabled={reqBusy}>Cancel</button>
                  <button className="fv-modal-ok" onClick={submitRequest} disabled={reqBusy}>{reqBusy ? "Sending..." : "Send Request"}</button>
                </div>
              </>
            )}
          </div>
        </ModalOverlay>
      )}

      {toast && <div className={`fv-toast fv-toast-${toast.type}`}>{toast.text}</div>}
    </DashboardLayout>
  );
}

export default FieldView;
