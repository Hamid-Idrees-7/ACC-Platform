import { useState, useMemo, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import DashboardLayout from "../components/DashboardLayout";
import { usePermissions } from "../context/PermissionContext";
import { useCompany } from "../context/CompanyContext";
import { offDayOf } from "../config/companyConfig";
import { attendanceService } from "../services/attendanceService";
import DatePicker from "../components/DatePicker";
import { formatDayMonth, formatDateShort, toISODate as toISO, todayISO, addDaysISO } from "../utils/dates";
import { moneyCompact } from "../utils/format";
import "./MarkAttendance.css";
import { useLiveRefresh } from "../hooks/useLive";
import { useUnsavedChanges, leaveSafely } from "../hooks/useUnsavedChanges";
import { SkeletonPage } from "../components/Skeleton";
import { useLoader } from "../hooks/useLoader";
import { useToast } from "../components/Toast";
import { loadFailure, NO_ACCESS_TITLE, NO_ACCESS_TEXT } from "../utils/errors";

const dm = (d) => formatDayMonth(d);
const dmy = (d) => formatDateShort(d);
const byName = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" }).compare;

// Compact money for wage tags: 75000 is 75.0K, 120000 is 1.20 Lac (or 120.0K)
const money = (n) => moneyCompact(n);
const wageLabel = (w) => (w.wageType === "Monthly" ? `${money(w.wageAmount)}/mo` : w.wageType === "Contract" ? `${money(w.wageAmount)} contract` : `${money(w.wageAmount)}/day`);

function MarkAttendance() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = usePermissions();
  const canMark = can("Attendance", "Mark");
  // Weekly off days and holidays (Settings > Calendar)
  const { calendar } = useCompany();
  const hasOffDays = (calendar.weeklyOffDays || []).length > 0 || (calendar.holidays || []).length > 0;

  const [params] = useSearchParams();
  const askedDate = params.get("date");
  const [date, setDate] = useState(/^\d{4}-\d{2}-\d{2}$/.test(askedDate || "") && askedDate <= todayISO() ? askedDate : todayISO());
  const [sheet, setSheet] = useState(null);
  // The date the shown sheet belongs to. It differs from date while another day loads
  // (or failed to load), and the old marks must never be saved onto the new day.
  const [sheetDate, setSheetDate] = useState(null);
  const [marks, setMarks] = useState({});
  const [expanded, setExpanded] = useState({});
  // Workers not on site on the chosen date are folded away per section
  const [showAway, setShowAway] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [toast, showToast] = useToast(2500);

  const marksFromSheet = (data) => {
    const m = {};
    [...(data.monthlyStaff || []), ...(data.dailyWorkers || [])].forEach((w) => {
      m[w.assignmentID] = { status: w.status || null, note: w.note || "" };
    });
    return m;
  };

  // Only the answer for the day asked last is used; an older, slower one is ignored.
  const wanted = useRef("");
  const showSheet = (data, d) => {
    setSheet(data);
    setSheetDate(d);
    setMarks(marksFromSheet(data));
  };

  const load = async (d) => {
    const key = `${id}|${d}`;
    wanted.current = key;
    setLoading(true);
    try {
      const data = await attendanceService.getSheet(id, d);
      if (wanted.current === key) { showSheet(data, d); setLoadError(""); }
    } catch (err) {
      if (wanted.current === key) {
        setLoadError(loadFailure(err));
        showToast("Could not load attendance for this date.", "error");
      }
    } finally {
      if (wanted.current === key) setLoading(false);
    }
  };

  useLoader(() => load(date), `${id}|${date}`);

  const dirty = !!sheet && JSON.stringify(marks) !== JSON.stringify(marksFromSheet(sheet));
  useUnsavedChanges(dirty);
  useLiveRefresh(["attendance", "assignments", "calendar"], async () => {
    const key = `${id}|${date}`;
    try {
      const data = await attendanceService.getSheet(id, date);
      if (wanted.current === key) showSheet(data, date);
    } catch {
      return;
    }
  }, { paused: dirty || saving });

  const isToday = date === todayISO();
  const isFuture = date > todayISO();
  const readOnly = sheet?.isReadOnly || !canMark;
  const stale = sheetDate !== date;
  const canEdit = !readOnly && !isFuture && !stale;
  const offDay = offDayOf(calendar, date);

  // Another day with unsaved marks asks first (the marks belong to this day)
  const goToDate = (d) => { if (d !== date) leaveSafely(() => setDate(d)); };
  const shiftDate = (days) => goToDate(addDaysISO(date, days));

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
    if (!canEdit || saving) return;
    // Saved for the day these marks were made on
    const day = sheetDate;
    setSaving(true);
    try {
      // Only rows changed here are sent, so a mark made from site meanwhile is never overwritten
      const saved = marksFromSheet(sheet);
      const entries = onSiteWorkers
        .filter((w) => {
          const m = marks[w.assignmentID];
          const s = saved[w.assignmentID] || {};
          return m?.status && (m.status !== s.status || (m.note?.trim() || "") !== (s.note || ""));
        })
        .map((w) => ({ assignmentID: w.assignmentID, status: marks[w.assignmentID].status, note: marks[w.assignmentID].note?.trim() || null }));
      if (entries.length === 0) {
        // Only spaces or nothing changed: back to the saved marks, so the page isn't left "unsaved"
        setMarks(saved);
        showToast("Nothing new to save.", "error");
        return;
      }
      const updated = await attendanceService.save(id, day, entries);
      if (wanted.current === `${id}|${day}`) showSheet(updated, day);
      showToast("Attendance saved.");
    } catch (err) {
      showToast(err.response?.data?.message || "Could not save attendance.", "error");
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
            {sheet.showWages !== false && <span className="mka-wage">{wageLabel(w)}</span>}
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
                    const off = !d.status && offDayOf(calendar, iso);
                    const cls = d.status === "Present" ? "present" : d.status === "Absent" ? "absent" : off ? "off" : "none";
                    return (
                      <button key={iso} className={`mka-dot ${cls} ${iso === date ? "sel" : ""}`} onClick={() => goToDate(iso)} title={off ? `${dmy(d.date)} · ${off.kind === "holiday" ? off.name : "weekly off"}` : dmy(d.date)}>
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
                  {hasOffDays && <span><i className="off" /> Off day / holiday</span>}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // On-site workers first, A to Z (Labourer 2 before Labourer 10). Those who ended
  // or start later sit under a fold, since there is nothing to mark for them that day.
  const renderSection = (title, list, key) => {
    if (!list || list.length === 0) return null;
    const sorted = [...list].sort((a, b) =>
      byName(a.employeeName || "", b.employeeName || "") || String(a.startDate).localeCompare(String(b.startDate)));
    const here = sorted.filter((w) => w.onSiteThisDate);
    const away = sorted.filter((w) => !w.onSiteThisDate);
    const open = !!showAway[key];
    return (
      <div className={`mka-section ${stale ? "stale" : ""}`}>
        <div className="mka-section-title">{title}</div>
        {here.map(renderWorker)}
        {away.length > 0 && (
          <>
            <button className="mka-away-toggle" aria-expanded={open} onClick={() => setShowAway((prev) => ({ ...prev, [key]: !prev[key] }))}>
              {open ? "Hide" : "Show"} {away.length} not on site on this date
              <svg className={`mka-chev ${open ? "up" : ""}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
            </button>
            {open && away.map(renderWorker)}
          </>
        )}
      </div>
    );
  };

  if (loading && !sheet) {
    return (
      <DashboardLayout title="Mark Attendance">
        <SkeletonPage stats={3} rows={6} />
      </DashboardLayout>
    );
  }

  if (!sheet) {
    return (
      <DashboardLayout title="Mark Attendance">
        <button className="mka-back" onClick={() => leaveSafely(() => navigate("/dashboard/attendance"))}>← All Projects</button>
        <div className="mka-error">
          {loadError === "denied" ? `${NO_ACCESS_TITLE}. ${NO_ACCESS_TEXT}`
            : loadError === "failed" ? "Could not load attendance. Check your connection and refresh the page."
            : "Project not found."}
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Mark Attendance">
      <button className="mka-back" onClick={() => leaveSafely(() => navigate("/dashboard/attendance"))}>← All Projects</button>

      <div className="mka-head">
        <div className="mka-head-left">
          <h2>{sheet.projectTitle}</h2>
          <div className="mka-incharge">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
            Site Incharge: <strong>{sheet.siteIncharge}</strong>
          </div>
        </div>
        <div className="mka-date-wrap">
          <span className="mka-date-label">DATE{offDay && <em className="mka-off-tag">{offDay.kind === "holiday" ? "HOLIDAY" : "WEEKLY OFF"}</em>}</span>
          <div className="mka-date">
            <button className="mka-date-nav" onClick={() => shiftDate(-1)} aria-label="Previous day">‹</button>
            <div className="mka-date-box"><DatePicker value={date} onChange={(v) => goToDate(v || todayISO())} allowClear={false} /></div>
            <button className="mka-date-nav" onClick={() => shiftDate(1)} aria-label="Next day">›</button>
            <button className={`mka-today ${isToday ? "active" : ""}`} onClick={() => goToDate(todayISO())}>Today</button>
          </div>
        </div>
      </div>

      <div className="mka-bar">
        <div className="mka-stats">
          <span className="mka-stat present">{counts.p} Present</span>
          <span className="mka-stat absent">{counts.a} Absent</span>
          <span className="mka-stat none">{counts.u} {offDay ? "Off" : "Unmarked"}</span>
        </div>
        {!readOnly && (
          <div className="mka-actions">
            <button className="mka-all" onClick={markAllPresent} disabled={!canEdit || onSiteWorkers.length === 0}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              Mark All Present
            </button>
            <button className="mka-save" onClick={save} disabled={saving || !canEdit}>{saving ? "Saving..." : "Save Attendance"}</button>
          </div>
        )}
      </div>

      {stale && !loading && (
        <div className="mka-banner warn">
          <span>Attendance for {dmy(date)} could not be loaded. The list below is still {dmy(sheetDate)}.</span>
          <button className="mka-retry" onClick={() => load(date)}>Retry</button>
        </div>
      )}
      {sheet.isReadOnly && (
        <div className="mka-banner cancel">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
          This project is <strong>cancelled</strong>. Attendance is read-only — past records are shown for reference, but no new marking is allowed.
        </div>
      )}
      {!sheet.isReadOnly && isFuture && (
        <div className="mka-banner warn">This is a future date — attendance can only be marked up to today.</div>
      )}
      {!sheet.isReadOnly && !isFuture && offDay && onSiteWorkers.length > 0 && (
        <div className="mka-banner info">
          <span>
            {offDay?.kind === "holiday"
              ? <>This day is a company holiday: <strong>{offDay.name}</strong>.</>
              : <><strong>{offDay?.name}</strong> is the weekly off.</>}
            {" "}Mark only the workers who came in; the rest can stay unmarked.
          </span>
        </div>
      )}
      {!sheet.isReadOnly && !isFuture && onSiteWorkers.length === 0 && (
        <div className="mka-banner warn">No worker is on site on this date.</div>
      )}

      {renderSection("MONTHLY STAFF", sheet.monthlyStaff, "monthly")}
      {renderSection("DAILY WORKERS", sheet.dailyWorkers, "daily")}

      {toast && <div className={`mka-toast mka-toast-${toast.type}`}>{toast.text}</div>}
    </DashboardLayout>
  );
}

export default MarkAttendance;
