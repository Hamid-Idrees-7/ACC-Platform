import { useState, useEffect, useCallback } from "react";
import { profileService } from "../services/profileService";
import { usePreferences } from "../context/PreferencesContext";
import { IDLE_CHOICES, DEFAULT_IDLE_MINUTES } from "../config/sessionConfig";
import Toast, { useToast } from "./Toast";
import { SessionList, ActivityList, ConfirmDialog } from "./SecurityOverview";
import "./SecuritySettings.css";

// Settings > Security: automatic sign-out, signed-in devices and sign-in history.
// Prefix: scs- (the lists come from SecurityOverview, prefix sov-)
function SecuritySettings() {
  const { prefs, updatePrefs } = usePreferences();
  const [toast, showToast] = useToast(3500);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [savingIdle, setSavingIdle] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [confirm, setConfirm] = useState(null);   // { session } or { all: true }
  const [confirmBusy, setConfirmBusy] = useState(false);

  // quiet: reload after an action without the spinner (the page does not jump)
  const load = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    try {
      setData(await profileService.getSecurity());
      setLoadError("");
    } catch {
      if (!quiet) setLoadError("Could not load your devices and sign-in history. Please try again.");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  // First load: loading is already true, so the loader starts without setting it again.
  useEffect(() => {
    let cancelled = false;
    profileService.getSecurity()
      .then((result) => { if (!cancelled) setData(result); })
      .catch(() => { if (!cancelled) setLoadError("Could not load your devices and sign-in history. Please try again."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const idleMinutes = prefs.idleMinutes ?? DEFAULT_IDLE_MINUTES;
  const chooseIdle = async (minutes) => {
    if (minutes === idleMinutes || savingIdle !== null) return;
    setSavingIdle(minutes);
    try {
      await updatePrefs({ idleMinutes: minutes });
      showToast(minutes === 0 ? "Automatic sign-out is off." : "Automatic sign-out saved.");
    } catch (err) {
      showToast(err?.response?.data?.message || "Could not save. Please try again.", "error");
    } finally {
      setSavingIdle(null);
    }
  };

  const sessions = data?.sessions || [];
  const others = sessions.filter((s) => !s.isCurrent).length;

  const runConfirm = async () => {
    setConfirmBusy(true);
    try {
      if (confirm.all) {
        const res = await profileService.signOutOtherSessions();
        showToast(res.message || "Signed out of the other devices.");
      } else {
        setBusyId(confirm.session.id);
        const res = await profileService.signOutSession(confirm.session.id);
        showToast(res.message || "Signed out of that device.");
      }
      setConfirm(null);
      await load({ quiet: true });
    } catch (err) {
      showToast(err?.response?.data?.message || "Could not sign out. Please try again.", "error");
      setConfirm(null);
      await load({ quiet: true });
    } finally {
      setConfirmBusy(false);
      setBusyId(null);
    }
  };

  return (
    <div className="scs">
      {/* Automatic sign-out */}
      <section className="scs-section">
        <h4>Automatic sign-out</h4>
        <p>Signs you out after this long without any activity, in every open tab. A warning appears one minute before.</p>
        <div className="scs-idle" role="radiogroup" aria-label="Automatic sign-out">
          {IDLE_CHOICES.map((c) => (
            <button
              key={c.minutes}
              type="button"
              role="radio"
              aria-checked={idleMinutes === c.minutes}
              className={`scs-idle-option ${idleMinutes === c.minutes ? "active" : ""}`}
              onClick={() => chooseIdle(c.minutes)}
              disabled={savingIdle !== null}
            >
              <span className="scs-radio" aria-hidden="true" />
              <span className="scs-idle-text">
                <strong>{c.label}</strong>
                <span>{c.hint}</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Devices */}
      <section className="scs-section">
        <div className="scs-head">
          <div>
            <h4>Signed-in devices</h4>
            <p>Where your account is signed in right now. Sign out any device you don't recognise.</p>
          </div>
          <button
            type="button"
            className="scs-btn-outline"
            onClick={() => setConfirm({ all: true })}
            disabled={loading || !!loadError || others === 0}
          >
            Sign out all other devices
          </button>
        </div>

        {loading ? (
          <div className="scs-state"><div className="scs-spinner" /></div>
        ) : loadError ? (
          <div className="scs-error">
            <span>{loadError}</span>
            <button type="button" onClick={() => load()}>Try again</button>
          </div>
        ) : (
          <SessionList sessions={sessions} busyId={busyId} onSignOut={(session) => setConfirm({ session })} />
        )}
      </section>

      {/* History */}
      {!loading && !loadError && (
        <section className="scs-section">
          <h4>Sign-in activity</h4>
          <p>
            Every sign-in to your account in the last {data?.activityDays || 30} days, newest first. If you see one you
            don't recognise, change your password and sign out all other devices.
          </p>
          <ActivityList activity={data?.activity || []} days={data?.activityDays} />
        </section>
      )}

      {confirm && (
        <ConfirmDialog
          title={confirm.all ? "Sign out all other devices?" : "Sign out this device?"}
          text={confirm.all
            ? `You will stay signed in here. The other ${others === 1 ? "device" : `${others} devices`} will need to sign in again.`
            : `${confirm.session.browser} on ${confirm.session.os} will need to sign in again.`}
          confirmLabel={confirm.all ? "Sign out others" : "Sign out"}
          busy={confirmBusy}
          onConfirm={runConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}

      <Toast toast={toast} />
    </div>
  );
}

export default SecuritySettings;
