import { usePreferences } from "../context/PreferencesContext";
import { rupeesShort, amountInWords, setNumberSystem, getNumberSystem } from "../utils/format";
import { formatDate, formatDateShort, formatTime, setDatePrefs } from "../utils/dates";
import "./AppearanceSettings.css";

const THEMES = [
  { key: "light", label: "Light", hint: "Bright and clear" },
  { key: "dark", label: "Dark", hint: "Easy on the eyes at night" },
  { key: "system", label: "System", hint: "Follows your device" },
];

const NUMBER_FORMATS = [
  { key: "pk", label: "Pakistani", hint: "Lac and Crore" },
  { key: "intl", label: "International", hint: "Thousand, Million, Billion" },
];

const DATE_FORMATS = [
  { key: "dmy-text", label: "Day Month Year" },
  { key: "dmy-numeric", label: "DD/MM/YYYY" },
  { key: "mdy-text", label: "Month Day, Year" },
  { key: "iso", label: "YYYY-MM-DD" },
];

const TIME_FORMATS = [
  { key: "12h", label: "12-hour" },
  { key: "24h", label: "24-hour" },
];

const SAMPLE_AMOUNT = 12500000;

// Renders an example with a given setting, without changing what the rest of the app uses.
const sampleNumber = (system) => {
  const current = getNumberSystem();
  setNumberSystem(system);
  const text = { short: rupeesShort(SAMPLE_AMOUNT), words: amountInWords(SAMPLE_AMOUNT) };
  setNumberSystem(current);
  return text;
};

const sampleDate = (prefs, changes) => {
  const now = new Date();
  setDatePrefs({ ...prefs, ...changes });
  const text = { long: formatDate(now), short: formatDateShort(now), time: formatTime(now) };
  setDatePrefs(prefs);
  return text;
};

// A small picture of the dashboard in each theme.
function ThemePreview({ kind }) {
  return (
    <span className={`aps-preview aps-preview-${kind}`} aria-hidden="true">
      <span className="aps-pv-side" />
      <span className="aps-pv-main">
        <span className="aps-pv-bar" />
        <span className="aps-pv-row"><span /><span /></span>
        <span className="aps-pv-card" />
      </span>
    </span>
  );
}

// Settings > Appearance: theme, number format, date format and time format.
// Every choice is applied at once and saved to the server.
function AppearanceSettings() {
  const { prefs, updatePrefs, saveState } = usePreferences();

  const choose = (changes) => {
    updatePrefs(changes).catch(() => {
      // the context rolls back and shows the error message
    });
  };

  return (
    <div className="aps">
      <section className="aps-section">
        <h4>Theme</h4>
        <p>Choose how the dashboard looks. The public website always stays light.</p>
        <div className="aps-theme-grid" role="radiogroup" aria-label="Theme">
          {THEMES.map((t) => (
            <button
              key={t.key}
              type="button"
              role="radio"
              aria-checked={prefs.theme === t.key}
              className={`aps-theme ${prefs.theme === t.key ? "active" : ""}`}
              onClick={() => choose({ theme: t.key })}
            >
              <ThemePreview kind={t.key} />
              <span className="aps-option-text">
                <strong>{t.label}</strong>
                <span>{t.hint}</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="aps-section">
        <h4>Number format</h4>
        <p>How money totals are shortened and written in words across the system.</p>
        <div className="aps-choice-grid" role="radiogroup" aria-label="Number format">
          {NUMBER_FORMATS.map((f) => {
            const ex = sampleNumber(f.key);
            return (
              <button
                key={f.key}
                type="button"
                role="radio"
                aria-checked={prefs.numberFormat === f.key}
                className={`aps-choice ${prefs.numberFormat === f.key ? "active" : ""}`}
                onClick={() => choose({ numberFormat: f.key })}
              >
                <span className="aps-choice-head">
                  <strong>{f.label}</strong>
                  <span>{f.hint}</span>
                </span>
                <span className="aps-example">{ex.short}</span>
                <span className="aps-example-sub">{ex.words}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="aps-section">
        <h4>Date format</h4>
        <p>Used for every date on screen, on invoices and on payslips.</p>
        <div className="aps-list" role="radiogroup" aria-label="Date format">
          {DATE_FORMATS.map((f) => {
            const ex = sampleDate(prefs, { dateFormat: f.key });
            return (
              <button
                key={f.key}
                type="button"
                role="radio"
                aria-checked={prefs.dateFormat === f.key}
                className={`aps-row ${prefs.dateFormat === f.key ? "active" : ""}`}
                onClick={() => choose({ dateFormat: f.key })}
              >
                <span className="aps-radio" />
                <strong>{f.label}</strong>
                <span className="aps-row-example">{ex.long === ex.short ? ex.long : `${ex.long} · ${ex.short}`}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="aps-section">
        <h4>Time format</h4>
        <div className="aps-list aps-list-inline" role="radiogroup" aria-label="Time format">
          {TIME_FORMATS.map((f) => {
            const ex = sampleDate(prefs, { timeFormat: f.key });
            return (
              <button
                key={f.key}
                type="button"
                role="radio"
                aria-checked={prefs.timeFormat === f.key}
                className={`aps-row ${prefs.timeFormat === f.key ? "active" : ""}`}
                onClick={() => choose({ timeFormat: f.key })}
              >
                <span className="aps-radio" />
                <strong>{f.label}</strong>
                <span className="aps-row-example">{ex.time}</span>
              </button>
            );
          })}
        </div>
      </section>

      {saveState.status !== "idle" && (
        <div className={`aps-status aps-status-${saveState.status}`} role="status">
          {saveState.status === "saving" ? "Saving..." : saveState.message}
        </div>
      )}
    </div>
  );
}

export default AppearanceSettings;
