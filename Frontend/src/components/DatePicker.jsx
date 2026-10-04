import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { formatDate, companyToday } from "../utils/dates";
import "./DatePicker.css";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

// "2026-10-02" read as a local date. new Date("2026-10-02") is UTC midnight,
// which shows the day before for anyone west of UTC.
const parseValue = (value) => {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(value);
  return isNaN(d) ? null : d;
};

const toIso = (y, m, d) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

// The visible area the picker sits in: the nearest parent that scrolls or clips
// (eg a modal body), cut down to the window.
const visibleBox = (el) => {
  let top = 0, bottom = window.innerHeight;
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    if (/(auto|scroll|hidden)/.test(getComputedStyle(p).overflowY)) {
      const r = p.getBoundingClientRect();
      top = Math.max(top, r.top);
      bottom = Math.min(bottom, r.bottom);
      break;
    }
  }
  return { top, bottom };
};

// Custom date picker. value and onChange use ISO date strings (YYYY-MM-DD).
// id and invalid are optional: a form can jump to the picker and mark it red.
function DatePicker({ value, onChange, placeholder = "Select a date", allowClear = true, id, invalid = false }) {
  const [open, setOpen] = useState(false);
  const selected = parseValue(value);
  const [viewMonth, setViewMonth] = useState((selected || companyToday()).getMonth());
  const [viewYear, setViewYear] = useState((selected || companyToday()).getFullYear());
  const ref = useRef(null);
  const popupRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Opens below by default. It flips up only when it fits above and not below;
  // otherwise the modal or page scrolls just enough to show the whole calendar.
  useLayoutEffect(() => {
    const popup = popupRef.current;
    if (!open || !popup || !ref.current) return;
    const field = ref.current.getBoundingClientRect();
    // On a narrow screen a field near the right edge moves the calendar left to stay visible
    popup.style.left = "";
    const room = window.innerWidth - 8 - field.left;
    if (popup.offsetWidth > room) popup.style.left = `${room - popup.offsetWidth}px`;
    const box = visibleBox(ref.current);
    const need = popup.offsetHeight + 8;
    const up = box.bottom - field.bottom < need && field.top - box.top >= need;
    popup.classList.toggle("up", up);
    if (up) return;
    // Once now and once after the open animation, which starts a few px higher.
    const show = () => popup.scrollIntoView({ block: "nearest" });
    show();
    popup.addEventListener("animationend", show, { once: true });
  }, [open]);

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const today = companyToday();

  const isSameDay = (d, day) =>
    d && d.getDate() === day && d.getMonth() === viewMonth && d.getFullYear() === viewYear;

  const pickDay = (day) => {
    onChange(toIso(viewYear, viewMonth, day));
    setOpen(false);
  };

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
  };

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const toggleOpen = () => {
    if (!open) {
      // Open on the chosen month (the value may have been set from outside)
      if (selected) {
        setViewMonth(selected.getMonth());
        setViewYear(selected.getFullYear());
      }
    }
    setOpen(!open);
  };

  return (
    <div className="dp-wrap" ref={ref}>
      <button type="button" id={id} aria-invalid={invalid || undefined} className={`dp-input ${open ? "open" : ""} ${invalid ? "invalid" : ""}`} onClick={toggleOpen}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
        <span className={selected ? "dp-value" : "dp-placeholder"}>
          {selected ? formatDate(selected) : placeholder}
        </span>
      </button>
      {/* Its own button next to the field, so it can be reached with Tab too */}
      {value && allowClear && (
        <button type="button" className="dp-clear" aria-label="Clear date" onClick={() => onChange("")}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>
      )}

      {open && (
        <div className="dp-popup" ref={popupRef}>
          <div className="dp-head">
            <button type="button" className="dp-nav" onClick={prevMonth}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
            </button>
            <div className="dp-title">
              <select value={viewMonth} onChange={(e) => setViewMonth(Number(e.target.value))}>
                {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
              </select>
              <select value={viewYear} onChange={(e) => setViewYear(Number(e.target.value))}>
                {Array.from({ length: 80 }, (_, i) => today.getFullYear() - 60 + i).map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <button type="button" className="dp-nav" onClick={nextMonth}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
            </button>
          </div>

          <div className="dp-grid dp-daynames">
            {DAYS.map((d) => <span key={d} className="dp-dayname">{d}</span>)}
          </div>
          <div className="dp-grid">
            {cells.map((day, i) => day === null ? (
              <span key={`e${i}`} className="dp-cell empty" />
            ) : (
              <button
                type="button"
                key={day}
                className={`dp-cell ${isSameDay(selected, day) ? "selected" : ""} ${isSameDay(today, day) ? "today" : ""}`}
                onClick={() => pickDay(day)}
              >
                {day}
              </button>
            ))}
          </div>

          <div className="dp-footer">
            <button type="button" className="dp-today-btn" onClick={() => {
              const t = companyToday();
              setViewMonth(t.getMonth());
              setViewYear(t.getFullYear());
              onChange(toIso(t.getFullYear(), t.getMonth(), t.getDate()));
              setOpen(false);
            }}>Today</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default DatePicker;
