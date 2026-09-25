import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../components/DashboardLayout";
import { profileService } from "../services/profileService";
import ImageCropModal from "../components/ImageCropModal";
import "./Settings.css";

const isValidPhone = (phone) => {
  const raw = phone.trim().replace(/[\s-]/g, "");
  const normalized = raw.startsWith("+92") ? "0" + raw.slice(3) : raw;
  return /^0\d{10}$/.test(normalized);
};
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

function Settings() {
  const { user, updateUser, logout } = useAuth();
  const navigate = useNavigate();

  // Live demo logins keep a fixed username and password (the role switcher signs in with them)
  const isDemoAccount = !!user?.demo;

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [photo, setPhoto] = useState(null);

  // active section: profile | account | other
  const [tab, setTab] = useState("profile");

  // Profile form
  const [form, setForm] = useState({ fullName: "", email: "", phone: "", secondaryPhone: "", bio: "" });
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState({ type: "", text: "" });

  // Password form
  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" });
  const [showPw, setShowPw] = useState({ current: false, next: false, confirm: false });
  const [savingPw, setSavingPw] = useState(false);
  const [pwMsg, setPwMsg] = useState({ type: "", text: "" });

  // Photo
  const [cropSrc, setCropSrc] = useState(null);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const fileInputRef = useRef(null);

  // Username (golden re-auth)
  const [unlockOpen, setUnlockOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await profileService.get();
        setProfile(data);
        setPhoto(data.profilePicture || null);
        setForm({
          fullName: data.fullName || "",
          email: data.email || "",
          phone: data.phone || "",
          secondaryPhone: data.secondaryPhone || "",
          bio: data.bio || "",
        });
      } catch {
        setProfileMsg({ type: "error", text: "Could not load your profile." });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleFormChange = (field, value) => setForm({ ...form, [field]: value });
  const handlePwChange = (field, value) => setPwForm({ ...pwForm, [field]: value });

  // ---- Photo ----
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setProfileMsg({ type: "error", text: "Please choose an image file." });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setCropSrc(reader.result);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleCropDone = async (base64) => {
    setCropSrc(null);
    setSavingPhoto(true);
    setProfileMsg({ type: "", text: "" });
    try {
      await profileService.updatePicture(base64);
      setPhoto(base64);
      updateUser({ profilePicture: base64 });
      setProfileMsg({ type: "success", text: "Profile picture updated." });
    } catch (err) {
      setProfileMsg({ type: "error", text: err.response?.data?.message || "Could not update picture." });
    } finally {
      setSavingPhoto(false);
    }
  };

  const handleRemovePhoto = async () => {
    setSavingPhoto(true);
    try {
      await profileService.updatePicture(null);
      setPhoto(null);
      updateUser({ profilePicture: null });
      setProfileMsg({ type: "success", text: "Profile picture removed." });
    } catch {
      setProfileMsg({ type: "error", text: "Could not remove picture." });
    } finally {
      setSavingPhoto(false);
    }
  };

  // ---- Save profile ----
  const handleSaveProfile = async () => {
    setProfileMsg({ type: "", text: "" });
    if (!form.fullName.trim()) return setProfileMsg({ type: "error", text: "Full name is required." });
    if (!form.email.trim()) return setProfileMsg({ type: "error", text: "Email is required." });
    if (!isValidEmail(form.email)) return setProfileMsg({ type: "error", text: "Please enter a valid email address." });
    if (!form.phone.trim()) return setProfileMsg({ type: "error", text: "Phone number is required." });
    if (!isValidPhone(form.phone)) return setProfileMsg({ type: "error", text: "Enter a valid phone (11 digits, 0 or +92)." });
    if (form.secondaryPhone.trim() && !isValidPhone(form.secondaryPhone)) return setProfileMsg({ type: "error", text: "Secondary phone is not valid." });

    setSavingProfile(true);
    try {
      const res = await profileService.update({
        fullName: form.fullName,
        email: form.email,
        phone: form.phone,
        secondaryPhone: form.secondaryPhone,
        bio: form.bio,
      });
      setProfileMsg({ type: "success", text: res.message || "Profile updated." });
      updateUser({ fullName: form.fullName });
      setProfile({ ...profile, ...form });
    } catch (err) {
      setProfileMsg({ type: "error", text: err.response?.data?.message || "Could not update profile." });
    } finally {
      setSavingProfile(false);
    }
  };

  // ---- Change password ----
  const handleChangePassword = async () => {
    setPwMsg({ type: "", text: "" });
    if (!pwForm.current || !pwForm.next || !pwForm.confirm) return setPwMsg({ type: "error", text: "Please fill in all password fields." });
    if (pwForm.next.length < 5) return setPwMsg({ type: "error", text: "New password must be at least 5 characters." });
    if (pwForm.next !== pwForm.confirm) return setPwMsg({ type: "error", text: "New passwords do not match." });
    if (pwForm.next === pwForm.current) return setPwMsg({ type: "error", text: "New password must be different from the current one." });

    setSavingPw(true);
    try {
      const res = await profileService.changePassword(pwForm.current, pwForm.next);
      setPwMsg({ type: "success", text: res.message || "Password changed." });
      setPwForm({ current: "", next: "", confirm: "" });
    } catch (err) {
      setPwMsg({ type: "error", text: err.response?.data?.message || "Could not change password." });
    } finally {
      setSavingPw(false);
    }
  };

  const eyeIcon = (shown) => shown ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
  );

  const initials = (profile?.fullName || "U").split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
  const bioLen = form.bio.length;

  if (loading) {
    return (
      <DashboardLayout title="Settings">
        <div className="st-loading"><div className="st-spinner" /></div>
      </DashboardLayout>
    );
  }

  const tabs = [
    { key: "profile", label: "Profile Management", icon: <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></> },
    { key: "account", label: "Account Management", icon: <><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></> },
    { key: "other", label: "Other Settings", icon: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></> },
  ];

  return (
    <DashboardLayout title="Settings">
      <div className="st-layout">
        {/* Left nav */}
        <div className="st-nav">
          {tabs.map((t) => (
            <button key={t.key} className={`st-nav-item ${tab === t.key ? "active" : ""}`} onClick={() => setTab(t.key)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{t.icon}</svg>
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="st-content">
          {/* ============ PROFILE MANAGEMENT ============ */}
          {tab === "profile" && (
            <div className="st-panel">
              <div className="st-panel-head">
                <h3>Profile Management</h3>
                <p>Update your photo, name, contact details, and bio</p>
              </div>

              {profileMsg.text && <div className={`st-msg st-msg-${profileMsg.type}`}>{profileMsg.text}</div>}

              {/* Photo */}
              <div className="st-photo-row">
                <div className="st-photo-avatar">
                  {photo ? <img src={photo} alt="" /> : <span>{initials}</span>}
                  {savingPhoto && <div className="st-photo-loading"><div className="st-spinner-sm" /></div>}
                </div>
                <div className="st-photo-actions">
                  <button className="st-photo-btn" onClick={() => fileInputRef.current?.click()} disabled={savingPhoto}>
                    {photo ? "Change Photo" : "Upload Photo"}
                  </button>
                  {photo && <button className="st-photo-remove" onClick={handleRemovePhoto} disabled={savingPhoto}>Remove</button>}
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} style={{ display: "none" }} />
                </div>
              </div>

              <div className="st-form-grid">
                <div className="st-field">
                  <label>Full Name <span className="req">*</span></label>
                  <input type="text" maxLength={100} value={form.fullName} onChange={(e) => handleFormChange("fullName", e.target.value)} />
                </div>
                <div className="st-field">
                  <label>Email <span className="req">*</span></label>
                  <input type="email" maxLength={100} value={form.email} onChange={(e) => handleFormChange("email", e.target.value)} />
                </div>
                <div className="st-field">
                  <label>Phone <span className="req">*</span></label>
                  <input type="text" maxLength={15} placeholder="+92 300 0000000" value={form.phone} onChange={(e) => handleFormChange("phone", e.target.value)} />
                </div>
                <div className="st-field">
                  <label>Secondary Phone</label>
                  <input type="text" maxLength={15} placeholder="Optional" value={form.secondaryPhone} onChange={(e) => handleFormChange("secondaryPhone", e.target.value)} />
                </div>
                <div className="st-field st-field-full">
                  <div className="st-label-row">
                    <label>Bio</label>
                    <span className={`st-counter ${bioLen >= 450 ? "warn" : ""}`}>{bioLen}/500</span>
                  </div>
                  <textarea rows="3" maxLength={500} placeholder="A short description about yourself" value={form.bio} onChange={(e) => handleFormChange("bio", e.target.value)} />
                </div>
              </div>

              <div className="st-actions">
                <button className="st-btn-save" onClick={handleSaveProfile} disabled={savingProfile}>
                  {savingProfile ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          )}

          {/* ACCOUNT MANAGEMENT */}
          {tab === "account" && (
            <div className="st-panel">
              <div className="st-panel-head">
                <h3>Account Management</h3>
                <p>Manage your login username and password</p>
              </div>

              {/* Live demo: sign-in details are fixed, everything is shown but locked */}
              {isDemoAccount && (
                <div className="st-demo-note">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                  <div>
                    <strong>Locked in the live demo</strong>
                    <span>
                      Demo logins keep a fixed username and password so the role switcher always works.
                      In a real account, this is where you change them (your current password is required).
                      Your profile details and photo can still be changed.
                    </span>
                  </div>
                </div>
              )}

              {/* Username - golden locked card */}
              <div
                className={`st-gold-card ${isDemoAccount ? "st-gold-card-disabled" : ""}`}
                onClick={() => !isDemoAccount && setUnlockOpen(true)}
                aria-disabled={isDemoAccount}
              >
                <div className="st-gold-glow" />
                <div className="st-gold-content">
                  <div className="st-gold-icon">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                  </div>
                  <div className="st-gold-text">
                    <h4>Login Username</h4>
                    <p>
                      Current: <strong>@{profile?.username}</strong>
                      {isDemoAccount ? " — fixed for demo accounts" : " — tap to change (password required)"}
                    </p>
                  </div>
                  <div className="st-gold-lock">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                  </div>
                </div>
              </div>

              {/* Change password */}
              <fieldset className="st-subsection st-fieldset" disabled={isDemoAccount}>
                <h4 className="st-subsection-title">Change Password</h4>
                {pwMsg.text && <div className={`st-msg st-msg-${pwMsg.type}`}>{pwMsg.text}</div>}
                <div className="st-form-grid">
                  <div className="st-field st-field-full">
                    <label>Current Password <span className="req">*</span></label>
                    <div className="st-pw-wrap">
                      <input type={showPw.current ? "text" : "password"} value={pwForm.current} onChange={(e) => handlePwChange("current", e.target.value)} autoComplete="current-password" />
                      <button type="button" onClick={() => setShowPw({ ...showPw, current: !showPw.current })}>{eyeIcon(showPw.current)}</button>
                    </div>
                  </div>
                  <div className="st-field">
                    <label>New Password <span className="req">*</span></label>
                    <div className="st-pw-wrap">
                      <input type={showPw.next ? "text" : "password"} value={pwForm.next} onChange={(e) => handlePwChange("next", e.target.value)} autoComplete="new-password" />
                      <button type="button" onClick={() => setShowPw({ ...showPw, next: !showPw.next })}>{eyeIcon(showPw.next)}</button>
                    </div>
                    <span className="st-hint">At least 5 characters</span>
                  </div>
                  <div className="st-field">
                    <label>Confirm New Password <span className="req">*</span></label>
                    <div className="st-pw-wrap">
                      <input type={showPw.confirm ? "text" : "password"} value={pwForm.confirm} onChange={(e) => handlePwChange("confirm", e.target.value)} autoComplete="new-password" />
                      <button type="button" onClick={() => setShowPw({ ...showPw, confirm: !showPw.confirm })}>{eyeIcon(showPw.confirm)}</button>
                    </div>
                  </div>
                </div>
                <div className="st-actions">
                  <button className="st-btn-save" onClick={handleChangePassword} disabled={savingPw || isDemoAccount}>
                    {savingPw ? "Changing..." : "Change Password"}
                  </button>
                </div>
              </fieldset>
            </div>
          )}

          {/* OTHER SETTINGS */}
          {tab === "other" && (
            <div className="st-panel">
              <div className="st-panel-head">
                <h3>Other Settings</h3>
                <p>Preferences and additional options</p>
              </div>
              <div className="st-coming">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                <h4>More settings coming soon</h4>
                <p>Dark mode and other preferences will appear here.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Crop modal */}
      {cropSrc && <ImageCropModal imageSrc={cropSrc} onCancel={() => setCropSrc(null)} onCrop={handleCropDone} />}

      {/* Username change (golden re-auth) modal */}
      {unlockOpen && (
        <UsernameChangeModal
          currentUsername={profile?.username}
          onClose={() => setUnlockOpen(false)}
          onChanged={() => { logout(); navigate("/login"); }}
        />
      )}
    </DashboardLayout>
  );
}

// Username change modal (re-auth -> reveal to change to logout)
function UsernameChangeModal({ currentUsername, onClose, onChanged }) {
  const [step, setStep] = useState("auth"); // auth | reveal
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [msg, setMsg] = useState({ type: "", text: "" });
  const [busy, setBusy] = useState(false);
  const [verified, setVerified] = useState("");

  // Step 1: verify the current password before revealing the username field
  const handleUnlock = async () => {
    setMsg({ type: "", text: "" });
    if (!password) return setMsg({ type: "error", text: "Enter your password to continue." });

    setBusy(true);
    try {
      const { profileService } = await import("../services/profileService");
      await profileService.verifyPassword(password);
      setVerified(password);
      setBusy(false);
      setStep("reveal");
    } catch (err) {
      setBusy(false);
      setMsg({ type: "error", text: err.response?.data?.message || "Password is incorrect." });
    }
  };

  const handleSave = async () => {
    setMsg({ type: "", text: "" });
    if (!newUsername.trim()) return setMsg({ type: "error", text: "Enter a new username." });
    if (newUsername.trim().length < 3) return setMsg({ type: "error", text: "Username must be at least 3 characters." });
    if (/\s/.test(newUsername.trim())) return setMsg({ type: "error", text: "Username cannot contain spaces." });

    setBusy(true);
    try {
      const { profileService } = await import("../services/profileService");
      await profileService.changeUsername(verified, newUsername.trim());
      setMsg({ type: "success", text: "Username changed. Logging you out..." });
      setTimeout(() => onChanged(), 1400);
    } catch (err) {
      setBusy(false);
      setMsg({ type: "error", text: err.response?.data?.message || "Could not change username." });
    }
  };

  return (
    <div className="st-modal-overlay" onClick={(e) => e.target.classList.contains("st-modal-overlay") && onClose()}>
      <div className="st-modal st-modal-gold">
        <div className="st-modal-glow" />
        <button className="st-modal-close" onClick={onClose}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>

        <div className="st-modal-body">
          <div className="st-modal-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
          </div>

          {step === "auth" ? (
            <>
              <h3>Confirm it's you</h3>
              <p>Changing your username is a sensitive action. Enter your current password to continue.</p>
              {msg.text && <div className={`st-msg st-msg-${msg.type}`}>{msg.text}</div>}
              <div className="st-pw-wrap st-modal-input">
                <input type={showPw ? "text" : "password"} placeholder="Current password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" onKeyDown={(e) => e.key === "Enter" && handleUnlock()} />
                <button type="button" onClick={() => setShowPw(!showPw)}>
                  {showPw ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                  )}
                </button>
              </div>
              <button className="st-modal-btn" onClick={handleUnlock} disabled={busy}>{busy ? "Verifying..." : "Continue"}</button>
            </>
          ) : (
            <>
              <h3>Choose a new username</h3>
              <p>You're changing from <strong>@{currentUsername}</strong>. You'll be logged out and need to sign in again.</p>
              {msg.text && <div className={`st-msg st-msg-${msg.type}`}>{msg.text}</div>}
              <div className="st-modal-input">
                <input type="text" placeholder="New username" maxLength={50} value={newUsername} onChange={(e) => setNewUsername(e.target.value)} autoComplete="off" onKeyDown={(e) => e.key === "Enter" && !busy && handleSave()} />
              </div>
              <button className="st-modal-btn" onClick={handleSave} disabled={busy}>
                {busy ? "Saving..." : "Save & Re-login"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default Settings;
