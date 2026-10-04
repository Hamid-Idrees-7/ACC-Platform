import { useState, useMemo } from "react";
import { useCompany } from "../context/CompanyContext";
import { calendarService } from "../services/calendarService";
import DatePicker from "./DatePicker";
import { formatDateShort, formatMonthYear, todayISO, companyToday } from "../utils/dates";
import { hasLetter, focusField } from "../utils/validation";
import Toast, { useToast } from "./Toast";
import "./CompanySettings.css";
import "./CalendarSettings.css";
import ModalOverlay from "./ModalOverlay";

// Settings > Calendar (Admin only): weekly off days and company holidays.
// Every change is saved straight away. Attendance shows these days as off.

// Week order used on this page (Monday first) and the short labels.
const WEEK = [
  ["Monday", "Mon"], ["Tuesday", "Tue"], ["Wednesday", "Wed"], ["Thursday", "Thu"],
  ["Friday", "Fri"], ["Saturday", "Sat"], ["Sunday", "Sun"],
];
const JS_DAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Common holidays in Pakistan. Fixed ones fill their date for the year on screen;
// the Islamic ones follow the moon, so only the name is filled.
const SUGGESTIONS = [
  { name: "Eid ul Fitr" },
  { name: "Eid ul Adha" },
  { name: "Ashura" },
  { name: "Eid Milad un Nabi" },
  { name: "Kashmir Solidarity Day", month: 2, day: 5 },
  { name: "Pakistan Day", month: 3, day: 23 },
  { name: "Labour Day", month: 5, day: 1 },
  { name: "Youm-e-Takbeer", month: 5, day: 28 },
  { name: "Independence Day", month: 8, day: 14 },
  { name: "Iqbal Day", month: 11, day: 9 },
  { name: "Quaid-e-Azam Day", month: 12, day: 25 },
];

const MAX_DAYS = 31;
const EMPTY_FORM = { id: null, name: "", startDate: "", endDate: "" };

const pad = (n) => String(n).padStart(2, "0");
const iso = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
const isoOf = (v) => (v ? String(v).slice(0, 10) : "");
const daysBetween = (a, b) => Math.round((new Date(`${b}T00:00:00`) - new Date(`${a}T00:00:00`)) / 86400000) + 1;

const rangeText = (start, end) => {
  const s = isoOf(start), e = isoOf(end);
  return s === e ? formatDateShort(s) : `${formatDateShort(s)} – ${formatDateShort(e)}`;
};

// Same rules as the server.
const validate = (f) => {
  const e = {};
  const name = f.name.trim();
  if (name.length < 2) e.name = "Enter the holiday name, eg Eid ul Fitr.";
  else if (name.length > 60) e.name = "The name can be at most 60 characters.";
  else if (!hasLetter(name)) e.name = "The name must contain letters.";

  if (!f.startDate) e.startDate = "Choose the first day of the holiday.";
  else {
    const year = Number(f.startDate.slice(0, 4));
    if (year < 2000 || year > 2100) e.startDate = "Choose a date between 2000 and 2100.";
  }
  if (f.startDate && f.endDate) {
    if (f.endDate < f.startDate) e.endDate = "The last day can't be before the first day.";
    else if (daysBetween(f.startDate, f.endDate) > MAX_DAYS) e.endDate = `A holiday can be at most ${MAX_DAYS} days long.`;
  }
  return e;
};

const FIELD_ID = { name: "cal-name", startDate: "cal-start", endDate: "cal-end" };

function CalendarSettings() {
  const { calendar, applyCalendar } = useCompany();
  const weeklyOff = calendar.weeklyOffDays || [];
  const holidays = useMemo(
    () => [...(calendar.holidays || [])].sort((a, b) => isoOf(a.startDate).localeCompare(isoOf(b.startDate))),
    [calendar.holidays]
  );

  const [toast, showToast] = useToast(3500);
  const [savingDays, setSavingDays] = useState(false);
  const [daysError, setDaysError] = useState("");

  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const now = companyToday();
  const [view, setView] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const today = todayISO();

  // Weekly off

  const toggleDay = async (day) => {
    const next = weeklyOff.includes(day) ? weeklyOff.filter((d) => d !== day) : [...weeklyOff, day];
    if (next.length === 7) {
      setDaysError("At least one day of the week must be a working day.");
      return;
    }
    setDaysError("");
    setSavingDays(true);
    try {
      const result = await calendarService.saveWeeklyOff(next);
      applyCalendar(result);
      const list = result.weeklyOffDays || [];
      showToast(list.length ? `Weekly off saved: ${list.join(", ")}.` : "Weekly off removed. Every day is a working day.");
    } catch (err) {
      const msg = err?.response?.data?.message || "Could not save the weekly off days. Please try again.";
      setDaysError(msg);
      showToast(msg, "error");
    } finally {
      setSavingDays(false);
    }
  };

  // Holiday form

  const setField = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: "" }));
  };

  const showErrors = (errs) => {
    setErrors(errs);
    const first = ["name", "startDate", "endDate"].find((k) => errs[k]);
    if (first) focusField(FIELD_ID[first]);
  };

  const resetForm = () => { setForm(EMPTY_FORM); setErrors({}); };

  const saveHoliday = async () => {
    const errs = validate(form);
    if (Object.keys(errs).length) return showErrors(errs);

    setSaving(true);
    const payload = { name: form.name.trim(), startDate: form.startDate, endDate: form.endDate || form.startDate };
    try {
      const result = form.id
        ? await calendarService.updateHoliday(form.id, payload)
        : await calendarService.addHoliday(payload);
      applyCalendar(result);
      showToast(form.id ? `"${payload.name}" updated.` : `"${payload.name}" added to the calendar.`);
      resetForm();
    } catch (err) {
      const data = err?.response?.data;
      if (data?.field && FIELD_ID[data.field]) showErrors({ [data.field]: data.message });
      else showToast(data?.message || "Could not save the holiday. Please try again.", "error");
    } finally {
      setSaving(false);
    }
  };

  const editHoliday = (h) => {
    setForm({ id: h.holidayID, name: h.name, startDate: isoOf(h.startDate), endDate: isoOf(h.endDate) });
    setErrors({});
    const d = new Date(`${isoOf(h.startDate)}T00:00:00`);
    setView({ y: d.getFullYear(), m: d.getMonth() });
    focusField("cal-name");
  };

  const deleteHoliday = async () => {
    const h = confirmDelete;
    setConfirmDelete(null);
    try {
      const result = await calendarService.deleteHoliday(h.holidayID);
      applyCalendar(result);
      if (form.id === h.holidayID) resetForm();
      showToast(`"${h.name}" removed from the calendar.`);
    } catch (err) {
      showToast(err?.response?.data?.message || "Could not remove the holiday. Please try again.", "error");
    }
  };

  const applySuggestion = (s) => {
    if (s.month) {
      const date = iso(view.y, s.month - 1, s.day);
      setForm((f) => ({ ...f, name: s.name, startDate: date, endDate: "" }));
      setView({ y: view.y, m: s.month - 1 });
    } else {
      setForm((f) => ({ ...f, name: s.name }));
      focusField("cal-start");
    }
    setErrors({});
  };

  // Month grid

  const holidayOn = (day) => holidays.find((h) => day >= isoOf(h.startDate) && day <= isoOf(h.endDate));

  const cells = useMemo(() => {
    const first = new Date(view.y, view.m, 1);
    const lead = (first.getDay() + 6) % 7;          // Monday first
    const count = new Date(view.y, view.m + 1, 0).getDate();
    const list = [];
    for (let i = 0; i < lead; i++) list.push(null);
    for (let d = 1; d <= count; d++) list.push(iso(view.y, view.m, d));
    while (list.length % 7) list.push(null);
    return list;
  }, [view]);

  const shiftMonth = (delta) => {
    const d = new Date(view.y, view.m + delta, 1);
    setView({ y: d.getFullYear(), m: d.getMonth() });
  };

  // Clicking days picks the dates: the first click sets the first day, the second the last day.
  const pickDay = (day) => {
    setErrors((e) => ({ ...e, startDate: "", endDate: "" }));
    setForm((f) => {
      if (!f.startDate || f.endDate || day < f.startDate) return { ...f, startDate: day, endDate: "" };
      if (day === f.startDate) return f;
      return { ...f, endDate: day };
    });
  };

  const selEnd = form.endDate || form.startDate;
  const inSelection = (day) => form.startDate && day >= form.startDate && day <= selEnd;

  const selectedDays = form.startDate ? daysBetween(form.startDate, selEnd) : 0;
  const yearHolidays = holidays.filter((h) => isoOf(h.startDate).startsWith(String(view.y)) || isoOf(h.endDate).startsWith(String(view.y)));
  const offThisYear = yearHolidays.reduce((sum, h) => sum + h.days, 0);
  const shown = new Set(yearHolidays.map((h) => h.name.toLowerCase()));

  return (
    <div className="cal">
      {/* Weekly off */}
      <section className="cal-section">
        <div className="cps-sec-head">
          <h4>Weekly off</h4>
          <p>The days of the week the sites are closed. Click a day to turn it on or off; it is saved straight away.</p>
        </div>
        <div className="cal-week" role="group" aria-label="Weekly off days">
          {WEEK.map(([day, short]) => {
            const on = weeklyOff.includes(day);
            return (
              <button
                key={day}
                type="button"
                className={`cal-weekday ${on ? "on" : ""}`}
                aria-pressed={on}
                disabled={savingDays}
                onClick={() => toggleDay(day)}
                title={on ? `${day} is off. Click to make it a working day.` : `Click to make ${day} a weekly off.`}
              >
                <span className="cal-weekday-short">{short}</span>
                <span className="cal-weekday-state">{on ? "Off" : "Working"}</span>
              </button>
            );
          })}
        </div>
        {daysError
          ? <span className="st-err">{daysError}</span>
          : <span className="st-hint">{weeklyOff.length ? `Off every ${weeklyOff.join(" and ")}.` : "No weekly off: every day is a working day."}</span>}
      </section>

      {/* Holidays */}
      <section className="cal-section">
        <div className="cps-sec-head">
          <h4>Holidays</h4>
          <p>Eid, national days or any other days off. Pick the days on the calendar or in the form.</p>
        </div>

        <div className="cal-layout">
          {/* Month calendar */}
          <div className="cal-month">
            <div className="cal-month-head">
              <button type="button" className="cal-nav" onClick={() => shiftMonth(-1)} aria-label="Previous month">‹</button>
              <strong>{formatMonthYear(view.y, view.m)}</strong>
              <button type="button" className="cal-nav" onClick={() => shiftMonth(1)} aria-label="Next month">›</button>
            </div>
            <div className="cal-grid cal-grid-names">
              {WEEK.map(([day, short]) => <span key={day}>{short.slice(0, 2)}</span>)}
            </div>
            <div className="cal-grid">
              {cells.map((day, i) => {
                if (!day) return <span key={`e${i}`} className="cal-cell empty" />;
                const h = holidayOn(day);
                const weekly = weeklyOff.includes(JS_DAY[new Date(`${day}T00:00:00`).getDay()]);
                const cls = [
                  "cal-cell",
                  h ? "holiday" : weekly ? "weekly" : "",
                  inSelection(day) ? "sel" : "",
                  day === today ? "today" : "",
                ].join(" ");
                const label = h ? h.name : weekly ? "Weekly off" : "";
                return (
                  <button key={day} type="button" className={cls} onClick={() => pickDay(day)} title={label ? `${formatDateShort(day)} · ${label}` : formatDateShort(day)}>
                    {Number(day.slice(8))}
                  </button>
                );
              })}
            </div>
            <div className="cal-legend">
              <span><i className="holiday" /> Holiday</span>
              <span><i className="weekly" /> Weekly off</span>
              <span><i className="sel" /> Selected</span>
            </div>
            <p className="cal-year-note">
              {view.y}: {yearHolidays.length} holiday{yearHolidays.length === 1 ? "" : "s"}, {offThisYear} day{offThisYear === 1 ? "" : "s"} off
            </p>
          </div>

          {/* Add / edit */}
          <div className="cal-side">
            <div className="cal-form">
              <h5>{form.id ? "Edit holiday" : "Add a holiday"}</h5>
              <div className={`st-field ${errors.name ? "has-err" : ""}`}>
                <label htmlFor="cal-name">Name <span className="req">*</span></label>
                <input id="cal-name" type="text" maxLength={60} placeholder="eg Eid ul Adha" value={form.name} onChange={(e) => setField("name", e.target.value)} aria-invalid={!!errors.name} />
                {errors.name && <span className="st-err">{errors.name}</span>}
              </div>
              <div className="cal-dates">
                <div className={`st-field ${errors.startDate ? "has-err" : ""}`}>
                  <label htmlFor="cal-start">From <span className="req">*</span></label>
                  <DatePicker id="cal-start" value={form.startDate} onChange={(v) => setField("startDate", v)} placeholder="First day" invalid={!!errors.startDate} />
                  {errors.startDate && <span className="st-err">{errors.startDate}</span>}
                </div>
                <div className={`st-field ${errors.endDate ? "has-err" : ""}`}>
                  <label htmlFor="cal-end">To</label>
                  <DatePicker id="cal-end" value={form.endDate} onChange={(v) => setField("endDate", v)} placeholder="Same day" invalid={!!errors.endDate} />
                  {errors.endDate && <span className="st-err">{errors.endDate}</span>}
                </div>
              </div>
              {selectedDays > 0 && !errors.startDate && !errors.endDate && (
                <p className="cal-count">{rangeText(form.startDate, selEnd)} · {selectedDays} day{selectedDays === 1 ? "" : "s"}</p>
              )}
              <div className="cal-form-actions">
                {(form.id || form.name || form.startDate) && (
                  <button type="button" className="cps-btn-ghost" onClick={resetForm} disabled={saving}>Cancel</button>
                )}
                <button type="button" className="st-btn-save" onClick={saveHoliday} disabled={saving}>
                  {saving ? "Saving..." : form.id ? "Save holiday" : "Add holiday"}
                </button>
              </div>

              {!form.id && (
                <div className="cal-suggest">
                  <span>Quick add:</span>
                  {SUGGESTIONS.filter((s) => !shown.has(s.name.toLowerCase())).map((s) => (
                    <button key={s.name} type="button" onClick={() => applySuggestion(s)} title={s.month ? `Fills ${s.day}/${s.month}/${view.y}` : "Moon-based: pick the dates"}>
                      {s.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* List */}
            <div className="cal-list">
              <h5>All holidays <span>{holidays.length}</span></h5>
              {holidays.length === 0 ? (
                <p className="cal-empty">No holidays yet. Add Eid, national days or any other days the sites are closed.</p>
              ) : (
                holidays.map((h) => {
                  const past = isoOf(h.endDate) < today;
                  const current = isoOf(h.startDate) <= today && isoOf(h.endDate) >= today;
                  return (
                    <div key={h.holidayID} className={`cal-row ${past ? "past" : ""} ${form.id === h.holidayID ? "editing" : ""}`}>
                      <div className="cal-row-text">
                        <strong>{h.name}{current && <em className="cal-now">Today</em>}</strong>
                        <span>{rangeText(h.startDate, h.endDate)} · {h.days} day{h.days === 1 ? "" : "s"}</span>
                      </div>
                      <div className="cal-row-actions">
                        <button type="button" onClick={() => editHoliday(h)} aria-label={`Edit ${h.name}`}>Edit</button>
                        <button type="button" className="danger" onClick={() => setConfirmDelete(h)} aria-label={`Delete ${h.name}`}>Delete</button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </section>

      {confirmDelete && (
        <ModalOverlay className="st-modal-overlay" onClose={() => setConfirmDelete(null)}>
          <div className="st-modal st-leave" role="dialog" aria-modal="true" aria-labelledby="cal-del-title">
            <div className="st-modal-body">
              <h3 id="cal-del-title">Remove this holiday?</h3>
              <p><strong>{confirmDelete.name}</strong> ({rangeText(confirmDelete.startDate, confirmDelete.endDate)}) will become a normal working day again.</p>
              <div className="st-leave-actions">
                <button className="st-leave-keep" data-close onClick={() => setConfirmDelete(null)} autoFocus>Keep it</button>
                <button className="st-leave-discard" onClick={deleteHoliday}>Remove</button>
              </div>
            </div>
          </div>
        </ModalOverlay>
      )}

      <Toast toast={toast} />
    </div>
  );
}

export default CalendarSettings;
