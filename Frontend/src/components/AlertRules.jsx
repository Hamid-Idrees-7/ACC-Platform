import { useState, useEffect, useRef } from "react";
import { alertService } from "../services/alertService";
import { ALERT_GROUPS, ALERT_SEVERITY } from "../config/alertConfig";
import { useLiveRefresh } from "../hooks/useLive";
import Toast, { useToast } from "./Toast";
import "./AlertRules.css";
import { SkeletonRows } from "./Skeleton";

function Switch({ id, checked, onChange, label }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`alr-switch ${checked ? "on" : ""}`}
      onClick={() => onChange(!checked)}
    >
      <span className="alr-knob" />
    </button>
  );
}

const thresholdError = (rule, raw) => {
  const text = String(raw ?? "").trim();
  if (!/^\d+$/.test(text)) return `Enter a whole number from ${rule.min} to ${rule.max}.`;
  const value = Number(text);
  if (value < rule.min || value > rule.max) return `Enter a number from ${rule.min} to ${rule.max}.`;
  return null;
};

function AlertRules() {
  const [rules, setRules] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [drafts, setDrafts] = useState({});
  const [errors, setErrors] = useState({});
  const [toast, showToast] = useToast(3000);
  const queue = useRef(Promise.resolve());
  const busy = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const fetchRules = async () => {
      try {
        const data = await alertService.getRules();
        if (!cancelled) setRules(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setLoadError("Could not load the alert rules.");
      }
    };
    fetchRules();
    return () => { cancelled = true; };
  }, []);

  useLiveRefresh(["alert-rules"], async () => {
    try {
      const data = await alertService.getRules();
      if (busy.current === 0) setRules(Array.isArray(data) ? data : []);
    } catch {
      return;
    }
  });

  const replaceRule = (next) => setRules((prev) => prev.map((r) => (r.type === next.type ? next : r)));

  const save = (rule, changes, message) => {
    const before = rule;
    const optimistic = { ...rule, ...changes };
    replaceRule(optimistic);
    busy.current += 1;
    queue.current = queue.current.then(async () => {
      try {
        const data = await alertService.saveRule(rule.type, { enabled: optimistic.enabled, threshold: optimistic.threshold });
        const saved = Array.isArray(data) ? data.find((r) => r.type === rule.type) : null;
        if (saved) replaceRule(saved);
        showToast(message);
      } catch (err) {
        replaceRule(before);
        const text = err?.response?.data?.message || "Could not save. Please try again.";
        if (err?.response?.data?.field === "threshold") setErrors((prev) => ({ ...prev, [rule.type]: text }));
        else showToast(text, "error");
      } finally {
        busy.current -= 1;
      }
    });
  };

  const toggle = (rule, on) => save(rule, { enabled: on }, on ? `${rule.label} alerts are on.` : `${rule.label} alerts are off.`);

  const commitThreshold = (rule) => {
    const raw = drafts[rule.type];
    if (raw === undefined) return;
    const error = thresholdError(rule, raw);
    if (error) {
      setErrors((prev) => ({ ...prev, [rule.type]: error }));
      return;
    }
    const value = Number(String(raw).trim());
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[rule.type];
      return next;
    });
    setErrors((prev) => {
      const next = { ...prev };
      delete next[rule.type];
      return next;
    });
    if (value !== rule.threshold) save(rule, { threshold: value }, `${rule.label}: saved.`);
  };

  const editThreshold = (rule, value) => {
    setDrafts((prev) => ({ ...prev, [rule.type]: value }));
    if (errors[rule.type]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[rule.type];
        return next;
      });
    }
  };

  if (loadError) return <div className="alr-error">{loadError}</div>;
  if (!rules) return <SkeletonRows count={4} />;

  const offCount = rules.filter((r) => !r.enabled).length;

  return (
    <div className="alr">
      <p className="alr-intro">
        These rules apply to the whole company. The system checks them every few minutes and right after changes.
        Turning an alert off also clears its open alerts.
        {offCount > 0 && <strong> {offCount} of {rules.length} {offCount === 1 ? "is" : "are"} off.</strong>}
      </p>

      {ALERT_GROUPS.map((group) => {
        const items = rules.filter((r) => r.group === group);
        if (items.length === 0) return null;
        return (
          <section key={group} className="alr-group">
            <h5>{group}</h5>
            <ul className="alr-list">
              {items.map((rule) => {
                const id = `alr-${rule.type}`;
                const draft = drafts[rule.type];
                const error = errors[rule.type];
                const severity = ALERT_SEVERITY[rule.severity] || ALERT_SEVERITY.Info;
                return (
                  <li key={rule.type} className={`alr-row ${rule.enabled ? "" : "off"}`}>
                    <div className="alr-main">
                      <div className="alr-text">
                        <div className="alr-title">
                          <label htmlFor={id}>{rule.label}</label>
                          <span className={`alr-sev alr-sev-${rule.severity.toLowerCase()}`}>{severity.label}</span>
                        </div>
                        <span className="alr-desc">{rule.description}</span>
                        <span className="alr-who">Shown to: {rule.audience}</span>
                      </div>
                      <Switch id={id} checked={rule.enabled} onChange={(on) => toggle(rule, on)} label={rule.label} />
                    </div>
                    {rule.defaultThreshold != null && (
                      <div className="alr-threshold">
                        <label htmlFor={`${id}-value`}>{rule.thresholdLabel}</label>
                        <input
                          id={`${id}-value`}
                          type="text"
                          inputMode="numeric"
                          className={error ? "invalid" : ""}
                          value={draft ?? String(rule.threshold ?? "")}
                          onChange={(e) => editThreshold(rule, e.target.value)}
                          onBlur={() => commitThreshold(rule)}
                          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                          aria-invalid={!!error}
                          aria-describedby={error ? `${id}-error` : undefined}
                        />
                        <span className="alr-unit">{rule.unit}</span>
                        {rule.threshold !== rule.defaultThreshold && draft === undefined && (
                          <button type="button" className="alr-default" onClick={() => save(rule, { threshold: rule.defaultThreshold }, `${rule.label}: back to the default.`)}>
                            Use default ({rule.defaultThreshold})
                          </button>
                        )}
                        {error && <span id={`${id}-error`} className="alr-field-error">{error}</span>}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      <Toast toast={toast} />
    </div>
  );
}

export default AlertRules;
