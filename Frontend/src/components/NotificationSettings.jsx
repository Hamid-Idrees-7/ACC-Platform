import { useState, useRef } from "react";
import { usePreferences } from "../context/PreferencesContext";
import { usePermissions } from "../context/PermissionContext";
import { NOTIFICATION_GROUPS } from "../config/notificationConfig";
import { playNotificationSound } from "../utils/notificationSound";
import Toast, { useToast } from "./Toast";
import "./NotificationSettings.css";

function Switch({ id, checked, disabled = false, onChange, label }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`nfs-switch ${checked ? "on" : ""}`}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span className="nfs-knob" />
    </button>
  );
}

function NotificationSettings() {
  const { prefs, updatePrefs } = usePreferences();
  const { isAdmin, canView } = usePermissions();
  const [toast, showToast] = useToast(3000);
  const [draft, setDraft] = useState(null);
  const queue = useRef(Promise.resolve());
  const pending = useRef(0);

  const saved = { muted: prefs.mutedCategories || [], sound: prefs.notificationSound !== false };
  const current = draft || saved;
  const muted = current.muted;
  const soundOn = current.sound;

  const save = (next, message) => {
    setDraft(next);
    pending.current += 1;
    queue.current = queue.current.then(async () => {
      try {
        await updatePrefs({ mutedCategories: next.muted, notificationSound: next.sound });
        showToast(message);
      } catch (err) {
        showToast(err?.response?.data?.message || "Could not save. Please try again.", "error");
      } finally {
        pending.current -= 1;
        if (pending.current === 0) setDraft(null);
      }
    });
  };

  const toggleCategory = (item, on) => {
    const next = on ? muted.filter((c) => c !== item.category) : [...muted, item.category];
    save({ ...current, muted: next }, on ? `${item.label} notifications are on.` : `${item.label} notifications are off.`);
  };

  const toggleSound = (on) => {
    save({ ...current, sound: on }, on ? "Notification sound is on." : "Notification sound is off.");
    if (on) playNotificationSound({ shared: false });
  };

  const groups = NOTIFICATION_GROUPS
    .map((g) => ({ ...g, items: g.items.filter((i) => !i.module || isAdmin || canView(i.module)) }))
    .filter((g) => g.items.length > 0);

  const offCount = groups.reduce((n, g) => n + g.items.filter((i) => !i.locked && muted.includes(i.category)).length, 0);

  return (
    <div className="nfs">
      <section className="nfs-section">
        <h4>Sound</h4>
        <p>A short chime when a new notification arrives while you are using the system.</p>
        <div className="nfs-row">
          <div className="nfs-row-text">
            <label htmlFor="nfs-sound">Play a sound for new notifications</label>
            <span>Plays once, even with several tabs open.</span>
          </div>
          <button type="button" className="nfs-test" onClick={() => playNotificationSound({ shared: false })}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14" /></svg>
            Play sample
          </button>
          <Switch id="nfs-sound" checked={soundOn} onChange={toggleSound} label="Play a sound for new notifications" />
        </div>
      </section>

      <section className="nfs-section">
        <div className="nfs-head">
          <div>
            <h4>What reaches your bell</h4>
            <p>Turned-off notifications are not sent to your bell. Team Activity is a log of what other users did and always keeps everything.</p>
          </div>
          <button
            type="button"
            className={`nfs-reset ${offCount > 0 ? "" : "hidden"}`}
            tabIndex={offCount > 0 ? 0 : -1}
            aria-hidden={offCount === 0}
            onClick={() => save({ ...current, muted: [] }, "All notifications are on.")}
          >
            Turn all on
          </button>
        </div>

        {groups.map((g) => (
          <div key={g.key} className="nfs-group">
            <div className="nfs-group-head">
              <h5>{g.title}</h5>
              {g.hint && <span>{g.hint}</span>}
            </div>
            <ul className="nfs-list">
              {g.items.map((item) => {
                const on = item.locked || !muted.includes(item.category);
                const id = `nfs-${item.category.replace(/\s+/g, "-").toLowerCase()}`;
                return (
                  <li key={item.category} className={`nfs-row ${on ? "" : "off"}`}>
                    <div className="nfs-row-text">
                      <label htmlFor={id}>{item.label}</label>
                      {item.hint && <span>{item.hint}</span>}
                    </div>
                    {item.locked && <span className="nfs-always">Always on</span>}
                    <Switch
                      id={id}
                      checked={on}
                      disabled={item.locked}
                      onChange={(value) => toggleCategory(item, value)}
                      label={item.label}
                    />
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </section>

      <Toast toast={toast} />
    </div>
  );
}

export default NotificationSettings;
