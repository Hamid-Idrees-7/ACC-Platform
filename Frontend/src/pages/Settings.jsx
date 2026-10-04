import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, useSearchParams } from "react-router-dom";
import DashboardLayout from "../components/DashboardLayout";
import { profileService } from "../services/profileService";
import ImageCropModal from "../components/ImageCropModal";
import AppearanceSettings from "../components/AppearanceSettings";
import CompanySettings from "../components/CompanySettings";
import CalendarSettings from "../components/CalendarSettings";
import SecuritySettings from "../components/SecuritySettings";
import NotificationSettings from "../components/NotificationSettings";
import AlertRules from "../components/AlertRules";
import PasswordStrength from "../components/PasswordStrength";
import Toast, { useToast } from "../components/Toast";
import { isEmail, isPkPhone, isName, focusField } from "../utils/validation";
import { passwordError } from "../utils/password";
import "./Settings.css";
import ModalOverlay from "../components/ModalOverlay";
import { useUnsavedChanges, leaveWithoutAsking } from "../hooks/useUnsavedChanges";
import { SkeletonPage } from "../components/Skeleton";
import { typePhone, typed } from "../utils/format";
import { clickable } from "../utils/a11y";

const SETTINGS_TABS = ["profile", "account", "security", "notifications", "alerts", "appearance", "company", "calendar"];
const ADMIN_TABS = ["alerts", "company", "calendar"];
const BIO_MAX = 300;
const PROFILE_FIELDS = ["fullName", "email", "phone", "secondaryPhone", "bio"];

// Same rules as the server. Each returns { field: message }.
const validateProfile = (f) => {
  const e = {};
  const name = f.fullName.trim();
  if (name.length < 2) e.fullName = "Enter your full name.";
  else if (!isName(name)) e.fullName = "The name can only contain letters, spaces, dots and dashes.";
  if (!f.email.trim()) e.email = "Enter your email address.";
  else if (!isEmail(f.email)) e.email = "Enter a valid email address, eg name@company.com.";
  if (!f.phone.trim()) e.phone = "Enter your phone number.";
  else if (!isPkPhone(f.phone)) e.phone = "Enter a valid phone number: 11 digits starting with 0, or +92.";
  if (f.secondaryPhone.trim() && !isPkPhone(f.secondaryPhone)) e.secondaryPhone = "Enter a valid phone number: 11 digits starting with 0, or +92.";
  if (f.bio.length > BIO_MAX) e.bio = `The bio can be at most ${BIO_MAX} characters.`;
  return e;
};

const validatePassword = (f) => {
  const e = {};
  if (!f.current) e.current = "Enter your current password.";
  if (!f.next) e.next = "Enter a new password.";
  else if (passwordError(f.next)) e.next = passwordError(f.next);
  else if (f.current && f.next === f.current) e.next = "The new password must be different from the current one.";
  if (!f.confirm) e.confirm = "Type the new password again.";
  else if (f.next && f.confirm !== f.next) e.confirm = "The passwords do not match.";
  return e;
};

// The server may answer with a field name, or with ASP.NET's list of errors per field.
const serverFieldErrors = (err, map) => {
  const data = err?.response?.data;
  if (data?.field) return { [data.field]: data.message };
  if (data?.errors) {
    const out = {};
    Object.entries(data.errors).forEach(([k, v]) => {
      const key = map[k.toLowerCase()];
      if (key) out[key] = Array.isArray(v) ? v[0] : String(v);
    });
    if (Object.keys(out).length) return out;
  }
  return null;
};


function Settings() {
  const { user, updateUser, logout } = useAuth();
  const navigate = useNavigate();

  // Live demo logins keep a fixed username and password (the role switcher signs in with them).
  const isDemoAccount = !!user?.demo;

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [photo, setPhoto] = useState(null);

  // Active section lives in the address (?tab=appearance), so it survives a reload.
  // Company is for the Admin only.
  const isAdmin = user?.role?.toLowerCase() === "admin";
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get("tab");
  const tab = SETTINGS_TABS.includes(requested) && (!ADMIN_TABS.includes(requested) || isAdmin) ? requested : "profile";
  const goToTab = (key) => setSearchParams(key === "profile" ? {} : { tab: key }, { replace: true });

  // Phones: the section tabs scroll sideways, so the open one is brought into view.
  const navRef = useRef(null);
  useEffect(() => {
    const nav = navRef.current;
    const active = nav?.querySelector(".st-nav-item.active");
    if (!nav || !active || nav.scrollWidth <= nav.clientWidth) return;
    const left = active.getBoundingClientRect().left - nav.getBoundingClientRect().left + nav.scrollLeft;
    nav.scrollTo({ left: left - (nav.clientWidth - active.offsetWidth) / 2 });
  }, [tab, loading]);

  // Leaving a tab with unsaved changes asks first.
  const [companyDirty, setCompanyDirty] = useState(false);
  const [pendingTab, setPendingTab] = useState(null);
  const onCompanyDirty = useCallback((d) => setCompanyDirty(d), []);
  const setTab = (key) => {
    if (key === tab) return;
    const tabDirty = (tab === "company" && companyDirty) || (tab === "profile" && profileDirty) || (tab === "account" && passwordDirty);
    if (tabDirty) { setPendingTab(key); return; }
    goToTab(key);
  };
  const leaveTab = () => {
    setCompanyDirty(false);
    if (tab === "profile" && profile) setForm(Object.fromEntries(PROFILE_FIELDS.map((k) => [k, profile[k] || ""])));
    if (tab === "account") setPwForm({ current: "", next: "", confirm: "" });
    goToTab(pendingTab);
    setPendingTab(null);
  };

  const [form, setForm] = useState({ fullName: "", email: "", phone: "", secondaryPhone: "", bio: "" });
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileErrors, setProfileErrors] = useState({});
  const [loadError, setLoadError] = useState("");
  const [toast, showToast] = useToast(3500);

  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" });
  const [showPw, setShowPw] = useState({ current: false, next: false, confirm: false });
  const [savingPw, setSavingPw] = useState(false);
  const [pwErrors, setPwErrors] = useState({});

  const [cropSrc, setCropSrc] = useState(null);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const fileInputRef = useRef(null);

  // Username change modal (asks for the password again)
  const [unlockOpen, setUnlockOpen] = useState(false);

  // A new email needs the password too (reset links go there)
  const [emailConfirmOpen, setEmailConfirmOpen] = useState(false);

  const profileDirty = !!profile && PROFILE_FIELDS.some((k) => (form[k] || "") !== (profile[k] || ""));
  const passwordDirty = Object.values(pwForm).some((v) => v !== "");
  useUnsavedChanges(profileDirty || passwordDirty);

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
        setLoadError("Could not load your profile. Please refresh the page.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Typing in a field clears its message.
  const handleFormChange = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
    if (profileErrors[field]) setProfileErrors((e) => ({ ...e, [field]: "" }));
  };
  const handlePwChange = (field, value) => {
    setPwForm((f) => ({ ...f, [field]: value }));
    if (pwErrors[field]) setPwErrors((e) => ({ ...e, [field]: "" }));
  };

  // Shows the problems under their fields and takes the user to the first one.
  const showFieldErrors = (errs, setter, order, prefix) => {
    setter(errs);
    const first = order.find((k) => errs[k]);
    if (first) focusField(`${prefix}-${first}`);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      e.target.value = "";
      showToast("Please choose an image file (JPG, PNG or WebP).", "error");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      e.target.value = "";
      showToast("The image is larger than 5 MB. Choose a smaller one.", "error");
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
    try {
      await profileService.updatePicture(base64);
      setPhoto(base64);
      updateUser({ profilePicture: base64 });
      showToast("Profile picture updated.");
    } catch (err) {
      showToast(err.response?.data?.message || "Could not update the picture. Please try again.", "error");
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
      showToast("Profile picture removed.");
    } catch {
      showToast("Could not remove the picture. Please try again.", "error");
    } finally {
      setSavingPhoto(false);
    }
  };

  const PROFILE_ORDER = ["fullName", "email", "phone", "secondaryPhone", "bio"];
  const emailChanged = !!profile && form.email.trim().toLowerCase() !== (profile.email || "").trim().toLowerCase();

  const handleSaveProfile = async () => {
    const errs = validateProfile(form);
    if (Object.keys(errs).length) return showFieldErrors(errs, setProfileErrors, PROFILE_ORDER, "st-p");

    if (emailChanged && !isDemoAccount) return setEmailConfirmOpen(true);
    await saveProfile();
  };

  // Returns the password error for the confirm modal, if the server rejected the password.
  const saveProfile = async (currentPassword) => {
    setSavingProfile(true);
    try {
      const res = await profileService.update({
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        secondaryPhone: form.secondaryPhone.trim(),
        bio: form.bio.trim(),
        currentPassword,
      });
      setProfileErrors({});
      setEmailConfirmOpen(false);
      showToast(res.message || "Profile updated.");
      updateUser({ fullName: form.fullName.trim() });
      setProfile({ ...profile, ...form });
    } catch (err) {
      if (err.response?.data?.field === "currentPassword") return err.response.data.message;
      setEmailConfirmOpen(false);
      const fieldErrs = serverFieldErrors(err, { fullname: "fullName", email: "email", phone: "phone", secondaryphone: "secondaryPhone", bio: "bio" });
      if (fieldErrs) showFieldErrors(fieldErrs, setProfileErrors, PROFILE_ORDER, "st-p");
      else showToast(err.response?.data?.message || "Could not update your profile. Please try again.", "error");
    } finally {
      setSavingProfile(false);
    }
  };

  const PW_ORDER = ["current", "next", "confirm"];
  const handleChangePassword = async () => {
    const errs = validatePassword(pwForm);
    if (Object.keys(errs).length) return showFieldErrors(errs, setPwErrors, PW_ORDER, "st-pw");

    setSavingPw(true);
    try {
      const res = await profileService.changePassword(pwForm.current, pwForm.next);
      setPwErrors({});
      showToast(res.message || "Password changed.");
      setPwForm({ current: "", next: "", confirm: "" });
    } catch (err) {
      const fieldErrs = serverFieldErrors(err, { currentpassword: "current", newpassword: "next" });
      if (fieldErrs) showFieldErrors(fieldErrs, setPwErrors, PW_ORDER, "st-pw");
      else showToast(err.response?.data?.message || "Could not change the password. Please try again.", "error");
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

  // Profile and account need the profile data; the other tabs do not.
  if (loading && (tab === "profile" || tab === "account")) {
    return (
      <DashboardLayout title="Settings">
        <SkeletonPage stats={0} rows={6} />
      </DashboardLayout>
    );
  }

  const tabs = [
    { key: "profile", label: "Profile Management", icon: <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></> },
    { key: "account", label: "Account Management", icon: <><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></> },
    { key: "security", label: "Security", icon: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><polyline points="9 12 11 14 15 10" /></> },
    { key: "notifications", label: "Notifications", icon: <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></> },
    ...(isAdmin ? [{ key: "alerts", label: "Alert rules", icon: <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></> }] : []),
    { key: "appearance", label: "Appearance", icon: <><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></> },
    ...(isAdmin ? [{ key: "company", label: "Company", icon: <><path d="M3 21h18" /><path d="M5 21V7l8-4v18" /><path d="M19 21V11l-6-4" /><line x1="9" y1="9" x2="9" y2="9.01" /><line x1="9" y1="12" x2="9" y2="12.01" /><line x1="9" y1="15" x2="9" y2="15.01" /><line x1="9" y1="18" x2="9" y2="18.01" /></> }] : []),
    ...(isAdmin ? [{ key: "calendar", label: "Calendar", icon: <><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" /></> }] : []),
  ];

  return (
    <DashboardLayout title="Settings">
      <div className="st-layout">
        {/* Left nav */}
        <div className="st-nav" ref={navRef}>
          {tabs.map((t) => (
            <button key={t.key} className={`st-nav-item ${tab === t.key ? "active" : ""}`} onClick={() => setTab(t.key)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{t.icon}</svg>
              {t.label}
            </button>
          ))}
        </div>

        <div className="st-content">
          {/* Profile */}
          {tab === "profile" && (
            <div className="st-panel">
              <div className="st-panel-head">
                <h3>Profile Management</h3>
                <p>Update your photo, name, contact details, and bio</p>
              </div>

              {loadError && <div className="st-msg st-msg-error">{loadError}</div>}

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
                <div className={`st-field ${profileErrors.fullName ? "has-err" : ""}`}>
                  <label htmlFor="st-p-fullName">Full Name <span className="req">*</span></label>
                  <input id="st-p-fullName" type="text" maxLength={100} value={form.fullName} onChange={(e) => handleFormChange("fullName", e.target.value)} aria-invalid={!!profileErrors.fullName} />
                  {profileErrors.fullName && <span className="st-err">{profileErrors.fullName}</span>}
                </div>
                <div className={`st-field ${profileErrors.email ? "has-err" : ""}`}>
                  <label htmlFor="st-p-email">Email <span className="req">*</span></label>
                  <input id="st-p-email" type="email" maxLength={100} value={form.email} onChange={(e) => handleFormChange("email", e.target.value)} aria-invalid={!!profileErrors.email} />
                  {profileErrors.email && <span className="st-err">{profileErrors.email}</span>}
                </div>
                <div className={`st-field ${profileErrors.phone ? "has-err" : ""}`}>
                  <label htmlFor="st-p-phone">Phone <span className="req">*</span></label>
                  <input id="st-p-phone" type="tel" maxLength={15} placeholder="0300-1234567" value={form.phone} onChange={(e) => handleFormChange("phone", typed(e, typePhone))} aria-invalid={!!profileErrors.phone} />
                  {profileErrors.phone && <span className="st-err">{profileErrors.phone}</span>}
                </div>
                <div className={`st-field ${profileErrors.secondaryPhone ? "has-err" : ""}`}>
                  <label htmlFor="st-p-secondaryPhone">Secondary Phone</label>
                  <input id="st-p-secondaryPhone" type="tel" maxLength={15} placeholder="Optional" value={form.secondaryPhone} onChange={(e) => handleFormChange("secondaryPhone", typed(e, typePhone))} aria-invalid={!!profileErrors.secondaryPhone} />
                  {profileErrors.secondaryPhone && <span className="st-err">{profileErrors.secondaryPhone}</span>}
                </div>
                <div className={`st-field st-field-full ${profileErrors.bio ? "has-err" : ""}`}>
                  <div className="st-label-row">
                    <label htmlFor="st-p-bio">Bio</label>
                    <span className={`st-counter ${bioLen >= BIO_MAX - 30 ? "warn" : ""}`}>{bioLen}/{BIO_MAX}</span>
                  </div>
                  <textarea id="st-p-bio" rows="3" maxLength={BIO_MAX} placeholder="A short description about yourself" value={form.bio} onChange={(e) => handleFormChange("bio", e.target.value)} />
                  {profileErrors.bio && <span className="st-err">{profileErrors.bio}</span>}
                </div>
              </div>

              <div className="st-actions">
                <button className="st-btn-save" onClick={handleSaveProfile} disabled={savingProfile}>
                  {savingProfile ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          )}

          {/* Account */}
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

              {/* Username: the gold locked card */}
              <div
                className={`st-gold-card ${isDemoAccount ? "st-gold-card-disabled" : ""}`}
                {...(isDemoAccount ? {} : clickable(() => setUnlockOpen(true)))}
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
                <p className="st-subsection-note">Your other devices are signed out when the password changes. This one stays signed in.</p>
                <div className="st-form-grid">
                  <div className={`st-field st-field-full ${pwErrors.current ? "has-err" : ""}`}>
                    <label htmlFor="st-pw-current">Current Password <span className="req">*</span></label>
                    <div className="st-pw-wrap">
                      <input id="st-pw-current" type={showPw.current ? "text" : "password"} value={pwForm.current} onChange={(e) => handlePwChange("current", e.target.value)} autoComplete="current-password" />
                      <button type="button" onClick={() => setShowPw({ ...showPw, current: !showPw.current })}>{eyeIcon(showPw.current)}</button>
                    </div>
                    {pwErrors.current && <span className="st-err">{pwErrors.current}</span>}
                  </div>
                  <div className={`st-field ${pwErrors.next ? "has-err" : ""}`}>
                    <label htmlFor="st-pw-next">New Password <span className="req">*</span></label>
                    <div className="st-pw-wrap">
                      <input id="st-pw-next" type={showPw.next ? "text" : "password"} value={pwForm.next} onChange={(e) => handlePwChange("next", e.target.value)} autoComplete="new-password" aria-describedby="st-pw-strength" />
                      <button type="button" onClick={() => setShowPw({ ...showPw, next: !showPw.next })}>{eyeIcon(showPw.next)}</button>
                    </div>
                    {pwErrors.next && <span className="st-err">{pwErrors.next}</span>}
                    <PasswordStrength id="st-pw-strength" password={pwForm.next} />
                  </div>
                  <div className={`st-field ${pwErrors.confirm ? "has-err" : ""}`}>
                    <label htmlFor="st-pw-confirm">Confirm New Password <span className="req">*</span></label>
                    <div className="st-pw-wrap">
                      <input id="st-pw-confirm" type={showPw.confirm ? "text" : "password"} value={pwForm.confirm} onChange={(e) => handlePwChange("confirm", e.target.value)} autoComplete="new-password" />
                      <button type="button" onClick={() => setShowPw({ ...showPw, confirm: !showPw.confirm })}>{eyeIcon(showPw.confirm)}</button>
                    </div>
                    {pwErrors.confirm && <span className="st-err">{pwErrors.confirm}</span>}
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

          {/* Security */}
          {tab === "security" && (
            <div className="st-panel">
              <div className="st-panel-head">
                <h3>Security</h3>
                <p>Automatic sign-out, the devices you are signed in on, and your sign-in history</p>
              </div>
              <SecuritySettings />
            </div>
          )}

          {tab === "notifications" && (
            <div className="st-panel">
              <div className="st-panel-head">
                <h3>Notifications</h3>
                <p>Choose what reaches your bell, and whether new ones play a sound</p>
              </div>
              <NotificationSettings />
            </div>
          )}

          {tab === "alerts" && (
            <div className="st-panel">
              <div className="st-panel-head">
                <h3>Alert rules</h3>
                <p>Choose which problems the system watches for, and when it should warn</p>
              </div>
              <AlertRules />
            </div>
          )}

          {/* Appearance */}
          {tab === "appearance" && (
            <div className="st-panel">
              <div className="st-panel-head">
                <h3>Appearance</h3>
                <p>Theme, number format and date format. Saved to your account.</p>
              </div>
              <AppearanceSettings />
            </div>
          )}

          {/* Company (Admin) */}
          {tab === "company" && (
            <div className="st-panel">
              <div className="st-panel-head">
                <h3>Company</h3>
                <p>Company details, currency, invoice defaults and bank details. Used by the whole system.</p>
              </div>
              <CompanySettings onDirtyChange={onCompanyDirty} />
            </div>
          )}

          {/* Calendar (Admin) */}
          {tab === "calendar" && (
            <div className="st-panel">
              <div className="st-panel-head">
                <h3>Calendar</h3>
                <p>Weekly off days and company holidays. Attendance shows these days as off.</p>
              </div>
              <CalendarSettings />
            </div>
          )}
        </div>
      </div>

      <Toast toast={toast} />

      {/* Unsaved company changes */}
      {pendingTab && (
        <ModalOverlay className="st-modal-overlay" onClose={() => setPendingTab(null)}>
          <div className="st-modal st-leave" role="dialog" aria-modal="true" aria-labelledby="st-leave-title">
            <div className="st-modal-body">
              <h3 id="st-leave-title">Discard unsaved changes?</h3>
              <p>The changes you made on this tab have not been saved yet.</p>
              <div className="st-leave-actions">
                <button className="st-leave-keep" data-close onClick={() => setPendingTab(null)} autoFocus>Keep editing</button>
                <button className="st-leave-discard" onClick={leaveTab}>Discard changes</button>
              </div>
            </div>
          </div>
        </ModalOverlay>
      )}

      {cropSrc && <ImageCropModal imageSrc={cropSrc} onCancel={() => setCropSrc(null)} onCrop={handleCropDone} />}

      {emailConfirmOpen && (
        <EmailConfirmModal
          newEmail={form.email.trim()}
          busy={savingProfile}
          onClose={() => setEmailConfirmOpen(false)}
          onConfirm={saveProfile}
        />
      )}

      {unlockOpen && (
        <UsernameChangeModal
          currentUsername={profile?.username}
          onClose={() => setUnlockOpen(false)}
          onChanged={() => { logout(); leaveWithoutAsking(() => navigate("/login")); }}
        />
      )}
    </DashboardLayout>
  );
}

// Asks for the current password before a new email is saved.
function EmailConfirmModal({ newEmail, busy, onClose, onConfirm }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const confirm = async () => {
    if (busy) return;
    if (!password) return setError("Enter your password to continue.");
    const problem = await onConfirm(password);
    if (problem) setError(problem);
  };

  return (
    <ModalOverlay className="st-modal-overlay" onClose={onClose}>
      <div className="st-modal st-modal-gold" role="dialog" aria-modal="true" aria-labelledby="st-email-title">
        <div className="st-modal-glow" />
        <button className="st-modal-close" data-close onClick={onClose} aria-label="Close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>
        <div className="st-modal-body">
          <div className="st-modal-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
          </div>
          <h3 id="st-email-title">Confirm it's you</h3>
          <p>Password reset links will go to <strong>{newEmail}</strong>. Enter your current password to save the new email.</p>
          <div className={`st-pw-wrap st-modal-input ${error ? "has-err" : ""}`}>
            <input type="password" placeholder="Current password" value={password} onChange={(e) => { setPassword(e.target.value); setError(""); }} autoComplete="current-password" onKeyDown={(e) => e.key === "Enter" && confirm()} />
          </div>
          {error && <span className="st-err st-modal-err" role="alert">{error}</span>}
          <button className="st-modal-btn" onClick={confirm} disabled={busy}>{busy ? "Saving..." : "Save changes"}</button>
        </div>
      </div>
    </ModalOverlay>
  );
}

// Username change in two steps: confirm the password, then enter the new username. Saving it signs the user out.
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
    if (busy) return;   // held Enter fires again; each try counts against the password limit
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
    if (busy) return;
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
    <ModalOverlay className="st-modal-overlay" onClose={onClose}>
      <div className="st-modal st-modal-gold">
        <div className="st-modal-glow" />
        <button className="st-modal-close" data-close onClick={onClose}>
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
              <div className={`st-pw-wrap st-modal-input ${msg.type === "error" ? "has-err" : ""}`}>
                <input type={showPw ? "text" : "password"} placeholder="Current password" value={password} onChange={(e) => { setPassword(e.target.value); if (msg.type === "error") setMsg({ type: "", text: "" }); }} autoComplete="current-password" onKeyDown={(e) => e.key === "Enter" && !e.repeat && handleUnlock()} />
                <button type="button" onClick={() => setShowPw(!showPw)}>
                  {showPw ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                  )}
                </button>
              </div>
              {msg.type === "error" && <span className="st-err st-modal-err" role="alert">{msg.text}</span>}
              <button className="st-modal-btn" onClick={handleUnlock} disabled={busy}>{busy ? "Verifying..." : "Continue"}</button>
            </>
          ) : (
            <>
              <h3>Choose a new username</h3>
              <p>You're changing from <strong>@{currentUsername}</strong>. You'll be logged out and need to sign in again.</p>
              {msg.type === "success" && <div className="st-msg st-msg-success">{msg.text}</div>}
              <div className={`st-modal-input ${msg.type === "error" ? "has-err" : ""}`}>
                <input type="text" placeholder="New username" maxLength={50} value={newUsername} onChange={(e) => { setNewUsername(e.target.value); if (msg.type === "error") setMsg({ type: "", text: "" }); }} autoComplete="off" onKeyDown={(e) => e.key === "Enter" && !busy && handleSave()} />
              </div>
              {msg.type === "error" && <span className="st-err st-modal-err" role="alert">{msg.text}</span>}
              <button className="st-modal-btn" onClick={handleSave} disabled={busy}>
                {busy ? "Saving..." : "Save & Re-login"}
              </button>
            </>
          )}
        </div>
      </div>
    </ModalOverlay>
  );
}

export default Settings;
