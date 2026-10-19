import { useState, useEffect } from "react";
import { aiService } from "../services/aiService";
import Toast, { useToast } from "./Toast";
import "./AiSettings.css";

function Switch({ checked, disabled, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label}
      className={`ais-switch ${checked ? "on" : ""}`} disabled={disabled}
      onClick={() => onChange(!checked)}>
      <span className="ais-knob" />
    </button>
  );
}

function AiSettings() {
  const [ai, setAi] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loadErr, setLoadErr] = useState(false);
  const [toast, showToast] = useToast(3000);

  useEffect(() => {
    let active = true;
    aiService.getSettings()
      .then((d) => { if (active) setAi(d); })
      .catch(() => { if (active) setLoadErr(true); });
    return () => { active = false; };
  }, []);

  const toggle = async (key, value) => {
    if (!ai || busy) return;
    const previous = ai;
    setAi({ ...ai, [key]: value });
    setBusy(true);
    try {
      setAi(await aiService.updateSettings({ ...previous, [key]: value }));
      showToast(value ? "Assistant turned on." : "Assistant turned off.", "success");
    } catch {
      setAi(previous);
      showToast("Couldn't update that. Please try again.", "error");
    } finally {
      setBusy(false);
    }
  };

  if (loadErr) return <p className="ais-note">Couldn't load the AI settings. Please try again.</p>;
  if (!ai) return <p className="ais-note">Loading...</p>;

  return (
    <div className="ais">
      <div className={`ais-row ${ai.erpEnabled ? "" : "off"}`}>
        <div className="ais-row-text">
          <label>In-system assistant</label>
          <span>The AI Assistant for signed-in staff. Each person only sees what their access allows.</span>
        </div>
        <Switch checked={ai.erpEnabled} disabled={busy} onChange={(v) => toggle("erpEnabled", v)} label="In-system assistant" />
      </div>
      <div className={`ais-row ${ai.publicEnabled ? "" : "off"}`}>
        <div className="ais-row-text">
          <label>Public website assistant</label>
          <span>The chat bubble visitors see on the public website. Turning it off hides the bubble.</span>
        </div>
        <Switch checked={ai.publicEnabled} disabled={busy} onChange={(v) => toggle("publicEnabled", v)} label="Public website assistant" />
      </div>
      <Toast toast={toast} />
    </div>
  );
}

export default AiSettings;
