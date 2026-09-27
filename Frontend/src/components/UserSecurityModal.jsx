import { useState, useEffect, useCallback } from "react";
import { userService } from "../services/userService";
import Toast, { useToast } from "./Toast";
import { SessionList, ActivityList, ConfirmDialog } from "./SecurityOverview";
import "./UserSecurityModal.css";

// Users > a user > Sign-in activity: where the user is signed in and their sign-in history,
// with "Sign out of all devices" (a lost phone, someone leaving the company...). Prefix: usm-
function UserSecurityModal({ user, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, showToast] = useToast(3500);

  const load = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    try {
      setData(await userService.getSecurity(user.userID));
      setError("");
    } catch (err) {
      if (!quiet) setError(err?.response?.data?.message || "Could not load the sign-in activity. Please try again.");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [user.userID]);

  // First load: loading is already true, so the loader starts without setting it again.
  useEffect(() => {
    let cancelled = false;
    userService.getSecurity(user.userID)
      .then((result) => { if (!cancelled) setData(result); })
      .catch((err) => { if (!cancelled) setError(err?.response?.data?.message || "Could not load the sign-in activity. Please try again."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user.userID]);

  // Escape closes (unless the confirmation is open: it handles Escape itself).
  useEffect(() => {
    if (confirming) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirming, onClose]);

  const sessions = data?.sessions || [];

  const signOutAll = async () => {
    setBusy(true);
    try {
      const res = await userService.signOutEverywhere(user.userID);
      showToast(res.message || "Signed out of every device.");
      setConfirming(false);
      await load({ quiet: true });
    } catch (err) {
      showToast(err?.response?.data?.message || "Could not sign the user out. Please try again.", "error");
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  };

  const firstName = user.fullName.split(" ").find((w) => !/^engr\.?$/i.test(w)) || user.fullName;

  return (
    <div className="usm-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="usm" role="dialog" aria-modal="true" aria-labelledby="usm-title">
        <div className="usm-head">
          <div>
            <h3 id="usm-title">Sign-in activity</h3>
            <p>{user.fullName} · @{user.username}</p>
          </div>
          <button type="button" className="usm-close" onClick={onClose} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        <div className="usm-body">
          {loading ? (
            <div className="usm-state"><div className="usm-spinner" /></div>
          ) : error ? (
            <div className="usm-error">
              <span>{error}</span>
              <button type="button" onClick={() => load()}>Try again</button>
            </div>
          ) : (
            <>
              <section className="usm-section">
                <div className="usm-section-head">
                  <h4>Signed-in devices</h4>
                  <button type="button" className="usm-btn-danger" onClick={() => setConfirming(true)} disabled={sessions.length === 0}>
                    Sign out of all devices
                  </button>
                </div>
                <SessionList sessions={sessions} emptyText={`${firstName} is not signed in on any device.`} />
              </section>

              <section className="usm-section">
                <h4>Sign-in history</h4>
                <p className="usm-note">Last {data?.activityDays || 30} days, newest first.</p>
                <ActivityList activity={data?.activity || []} days={data?.activityDays} />
              </section>
            </>
          )}
        </div>
      </div>

      {confirming && (
        <ConfirmDialog
          title={`Sign ${firstName} out of every device?`}
          text={`${user.fullName} will need to sign in again on ${sessions.length === 1 ? "their device" : `all ${sessions.length} devices`}. Their account stays active.`}
          confirmLabel="Sign out everywhere"
          busy={busy}
          onConfirm={signOutAll}
          onCancel={() => setConfirming(false)}
        />
      )}

      <Toast toast={toast} />
    </div>
  );
}

export default UserSecurityModal;
