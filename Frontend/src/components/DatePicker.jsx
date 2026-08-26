import { useState, useRef, useEffect } from "react";
import "./DatePicker.css";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

// Format a Date to "11 August 2026"
export function formatDate(date) {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d)) return "";
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

// A pretty custom date picker. value/onChange use ISO date strings (YYYY-MM-DD).
function DatePicker({ value, onChange, placeholder = "Select a date", allowClear = true }) {
  const [open, setOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const selected = value ? new Date(value) : null;
  const [viewMonth, setViewMonth] = useState((selected || new Date()).getMonth());
  const [viewYear, setViewYear] = useState((selected || new Date()).getFullYear());
  const ref = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const isSameDay = (d, day) =>
    d && d.getDate() === day && d.getMonth() === viewMonth && d.getFullYear() === viewYear;

  const pickDay = (day) => {
    const picked = new Date(viewYear, viewMonth, day);
    // Build ISO string (local, no timezone shift)
    const iso = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    onChange(iso);
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

  // Decide whether the calendar opens downward or upward based on available space.
  // Prevents the popup from spilling below a modal and forcing the user to scroll.
  const toggleOpen = () => {
    if (!open && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      const popupHeight = 360;
      const spaceBelow = window.innerHeight - rect.bottom;
      setDropUp(spaceBelow < popupHeight && rect.top > spaceBelow);
    }
    setOpen(!open);
  };

  return (
    <div className="dp-wrap" ref={ref}>
      <button type="button" className={`dp-input ${open ? "open" : ""}`} onClick={toggleOpen}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
        <span className={selected ? "dp-value" : "dp-placeholder"}>
          {selected ? formatDate(selected) : placeholder}
        </span>
        {value && allowClear && (
          <span
            className="dp-clear"
            onClick={(e) => { e.stopPropagation(); onChange(""); }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </span>
        )}
      </button>

      {open && (
        <div className={`dp-popup ${dropUp ? "up" : ""}`}>
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
              const t = new Date();
              setViewMonth(t.getMonth());
              setViewYear(t.getFullYear());
              pickDay(t.getDate());
            }}>Today</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default DatePicker;
