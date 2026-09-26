import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import DashboardLayout from "../components/DashboardLayout";
import { usePermissions } from "../context/PermissionContext";
import { attendanceService } from "../services/attendanceService";
import DatePicker from "../components/DatePicker";
import { formatDayMonth, formatDateShort } from "../utils/dates";
import { rupeesCompact } from "../utils/format";
import "./MarkAttendance.css";

const dm = (d) => formatDayMonth(d);
const dmy = (d) => formatDateShort(d);
const toISO = (d) => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; };
const todayISO = () => toISO(new Date());

// Compact money for wage tags: 75000 -> 75.0K, 120000 -> 1.20 Lac (or 120.0K)
const money = (n) => rupeesCompact(n);
const wageLabel = (w) => (w.wageType === "Monthly" ? `${money(w.wageAmount)}/mo` : w.wageType === "Contract" ? `${money(w.wageAmount)} contract` : `${money(w.wageAmount)}/day`);

function MarkAttendance() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = usePermissions();
  const canMark = can("Attendance", "Mark");

  const [date, setDate] = useState(todayISO());
  const [sheet, setSheet] = useState(null);
  const [marks, setMarks] = useState({});
  const [expanded, setExpanded] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (text, type = "success") => { setToast({ text, type }); setTimeout(() => setToast(null), 2500); };

  const marksFromSheet = (data) => {
    const m = {};
    [...(data.monthlyStaff || []), ...(data.dailyWorkers || [])].forEach((w) => {
      m[w.assignmentID] = { status: w.status || null, note: w.note || "" };
    });
    return m;
  };

  const load = async (d) => {
    setLoading(true);
    try {
      const data = await attendanceService.getSheet(id, d);
      setSheet(data);
      setMarks(marksFromSheet(data));
    } catch {
      showToast("Could not load attendance.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(date); }, [id, date]);

  const isToday = date === todayISO();
  const isFuture = date > todayISO();
  const readOnly = sheet?.isReadOnly || !canMark;
  const canEdit = !readOnly && !isFuture;

  const shiftDate = (days) => { const x = new Date(date); x.setDate(x.getDate() + days); setDate(toISO(x)); };

  const allWorkers = useMemo(
    () => (sheet ? [...(sheet.monthlyStaff || []), ...(sheet.dailyWorkers || [])] : []),
    [sheet]
  );
  const onSiteWorkers = useMemo(() => allWorkers.filter((w) => w.onSiteThisDate), [allWorkers]);

  const counts = useMemo(() => {
    let p = 0, a = 0, u = 0;
    onSiteWorkers.forEach((w) => {
      const s = marks[w.assignmentID]?.status;
      if (s === "Present") p++; else if (s === "Absent") a++; else u++;
    });
    return { p, a, u };
  }, [onSiteWorkers, marks]);

  const setStatus = (w, status) => {
    if (!canEdit || !w.onSiteThisDate) return;
    setMarks((prev) => ({ ...prev, [w.assignmentID]: { ...prev[w.assignmentID], status } }));
  };
  const setNote = (w, note) => setMarks((prev) => ({ ...prev, [w.assignmentID]: { ...prev[w.assignmentID], note } }));

  const markAllPresent = () => {
    if (!canEdit) return;
    setMarks((prev) => {
      const next = { ...prev };
      onSiteWorkers.forEach((w) => { next[w.assignmentID] = { ...next[w.assignmentID], status: "Present" }; });
      return next;
    });
  };

  const save = async () => {
    if (readOnly) return;
    setSaving(true);
    try {
      const entries = onSiteWorkers
        .filter((w) => marks[w.assignmentID]?.status)
        .map((w) => ({ assignmentID: w.assignmentID, status: marks[w.assignmentID].status, note: marks[w.assignmentID].note?.trim() || null }));
      const updated = await attendanceService.save(id, date, entries);
      setSheet(updated);
      setMarks(marksFromSheet(updated));
      showToast("Attendance saved.");
    } catch {
      showToast("Could not save attendance.", "error");
    } finally {
      setSaving(false);
    }
  };

  const toggleExpand = (aid) => setExpanded((prev) => ({ ...prev, [aid]: !prev[aid] }));

  const offSiteBadge = (w) => {
    if (w.endDate && date > toISO(w.endDate)) return `Ended ${dmy(w.endDate)}`;
    if (date < toISO(w.startDate)) return `Starts ${dmy(w.startDate)}`;
    return "Not on site";
  };

  const renderWorker = (w) => {
    const mk = marks[w.assignmentID] || {};
    const isOpen = !!expanded[w.assignmentID];
    return (
      <div key={w.assignmentID} className={`mka-worker ${!w.onSiteThisDate ? "off" : ""}`}>
        <div className="mka-worker-head">
          <button className="mka-worker-who" onClick={() => toggleExpand(w.assignmentID)}>
            <span className={`mka-avatar ${w.onSiteThisDate ? "on" : ""}`}>{(w.employeeName || "?").charAt(0).toUpperCase()}</span>
            <span className="mka-worker-text">
              <span className="mka-worker-name">{w.employeeName}
                <svg className={`mka-chev ${isOpen ? "up" : ""}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
              </span>
              <span className="mka-worker-sub">{w.role} · <b>{dmy(w.startDate)} to {w.endDate ? dmy(w.endDate) : "ongoing"}</b></span>
            </span>
          </button>
          <div className="mka-worker-right">
            <span className="mka-wage">{wageLabel(w)}</span>
            {w.onSiteThisDate ? (
              <div className="mka-mark">
                <button className={`mka-btn present ${mk.status === "Present" ? "on" : ""}`} disabled={!canEdit} onClick={() => setStatus(w, "Present")}>Present</button>
                <button className={`mka-btn absent ${mk.status === "Absent" ? "on" : ""}`} disabled={!canEdit} onClick={() => setStatus(w, "Absent")}>Absent</button>
              </div>
            ) : (
              <span className="mka-ended">{offSiteBadge(w)}</span>
            )}
          </div>
        </div>

        {isOpen && (
          <div className="mka-worker-body">
            {w.onSiteThisDate && (
              <input className="mka-note" type="text" maxLength={255} placeholder="Optional note" value={mk.note || ""} onChange={(e) => setNote(w, e.target.value)} disabled={!canEdit} />
            )}
            {w.timeline.length > 0 && (
              <div className="mka-timeline">
                <div className="mka-timeline-title">ATTENDANCE · {dmy(w.startDate)} TO {w.endDate ? dmy(w.endDate) : "ONGOING"}</div>
                <div className="mka-dots">
                  {w.timeline.map((d) => {
                    const iso = toISO(d.date);
                    const cls = d.status === "Present" ? "present" : d.status === "Absent" ? "absent" : "none";
                    return (
                      <button key={iso} className={`mka-dot ${cls} ${iso === date ? "sel" : ""}`} onClick={() => setDate(iso)} title={dmy(d.date)}>
                        <i />
                        <span>{dm(d.date)}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="mka-legend">
                  <span><i className="present" /> Present</span>
                  <span><i className="absent" /> Absent</span>
                  <span><i className="none" /> Not marked</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  if (loading && !sheet) {
    return (
      <DashboardLayout title="Mark Attendance">
        <div className="mka-loading"><div className="mka-spinner" /><p>Loading...</p></div>
      </DashboardLayout>
    );
  }

  if (!sheet) {
    return (
      <DashboardLayout title="Mark Attendance">
        <button className="mka-back" onClick={() => navigate("/dashboard/attendance")}>← All Projects</button>
        <div className="mka-error">Project not found.</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Mark Attendance">
      <button className="mka-back" onClick={() => navigate("/dashboard/attendance")}>← All Projects</button>

      <div className="mka-head">
        <div className="mka-head-left">
          <h2>{sheet.projectTitle}</h2>
          <div className="mka-incharge">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
            Site Incharge: <strong>{sheet.siteIncharge}</strong>
          </div>
        </div>
        <div className="mka-date-wrap">
          <span className="mka-date-label">DATE</span>
          <div className="mka-date">
            <button className="mka-date-nav" onClick={() => shiftDate(-1)} aria-label="Previous day">‹</button>
            <div className="mka-date-box"><DatePicker value={date} onChange={(v) => setDate(v || todayISO())} allowClear={false} /></div>
            <button className="mka-date-nav" onClick={() => shiftDate(1)} aria-label="Next day">›</button>
            <button className={`mka-today ${isToday ? "active" : ""}`} onClick={() => setDate(todayISO())}>Today</button>
          </div>
        </div>
      </div>

      <div className="mka-bar">
        <div className="mka-stats">
          <span className="mka-stat present">{counts.p} Present</span>
          <span className="mka-stat absent">{counts.a} Absent</span>
          <span className="mka-stat none">{counts.u} Unmarked</span>
        </div>
        {!readOnly && (
          <div className="mka-actions">
            <button className="mka-all" onClick={markAllPresent} disabled={!canEdit || onSiteWorkers.length === 0}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              Mark All Present
            </button>
            <button className="mka-save" onClick={save} disabled={saving}>{saving ? "Saving..." : "Save Attendance"}</button>
          </div>
        )}
      </div>

      {sheet.isReadOnly && (
        <div className="mka-banner cancel">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
          This project is <strong>cancelled</strong>. Attendance is read-only — past records are shown for reference, but no new marking is allowed.
        </div>
      )}
      {!sheet.isReadOnly && isFuture && (
        <div className="mka-banner warn">This is a future date — attendance can only be marked up to today.</div>
      )}
      {!sheet.isReadOnly && !isFuture && onSiteWorkers.length === 0 && (
        <div className="mka-banner warn">No worker is on site on this date.</div>
      )}

      {sheet.monthlyStaff.length > 0 && (
        <div className="mka-section">
          <div className="mka-section-title">MONTHLY STAFF</div>
          {sheet.monthlyStaff.map(renderWorker)}
        </div>
      )}
      {sheet.dailyWorkers.length > 0 && (
        <div className="mka-section">
          <div className="mka-section-title">DAILY WORKERS</div>
          {sheet.dailyWorkers.map(renderWorker)}
        </div>
      )}

      {toast && <div className={`mka-toast mka-toast-${toast.type}`}>{toast.text}</div>}
    </DashboardLayout>
  );
}

export default MarkAttendance;
