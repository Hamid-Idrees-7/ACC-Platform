import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import DashboardLayout from "../components/DashboardLayout";
import { profileService } from "../services/profileService";
import ImageCropModal from "../components/ImageCropModal";
import "./Profile.css";

// Validate Pakistani phone: starts with 0 or +92, 11 digits after normalizing
const isValidPhone = (phone) => {
  const raw = phone.trim().replace(/[\s-]/g, "");
  const normalized = raw.startsWith("+92") ? "0" + raw.slice(3) : raw;
  return /^0\d{10}$/.test(normalized);
};

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

function Profile() {
  const { user, updateUser } = useAuth();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [photo, setPhoto] = useState(null); // Base64 current picture

  // Profile form
  const [form, setForm] = useState({ fullName: "", email: "", phone: "", secondaryPhone: "", bio: "" });
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState({ type: "", text: "" });

  // Password form
  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" });
  const [showPw, setShowPw] = useState({ current: false, next: false, confirm: false });
  const [savingPw, setSavingPw] = useState(false);
  const [pwMsg, setPwMsg] = useState({ type: "", text: "" });

  // Photo crop + view
  const [cropSrc, setCropSrc] = useState(null);
  const [viewPhoto, setViewPhoto] = useState(false);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const fileInputRef = useRef(null);

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

  // ---- Photo handlers ----
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
    e.target.value = ""; // allow re-selecting the same file
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

    if (!form.fullName.trim()) {
      return setProfileMsg({ type: "error", text: "Full name is required." });
    }
    if (!form.email.trim()) {
      return setProfileMsg({ type: "error", text: "Email is required." });
    }
    if (!isValidEmail(form.email)) {
      return setProfileMsg({ type: "error", text: "Please enter a valid email address." });
    }
    if (!form.phone.trim()) {
      return setProfileMsg({ type: "error", text: "Phone number is required." });
    }
    if (!isValidPhone(form.phone)) {
      return setProfileMsg({ type: "error", text: "Enter a valid phone (11 digits, starting with 0 or +92)." });
    }
    if (form.secondaryPhone.trim() && !isValidPhone(form.secondaryPhone)) {
      return setProfileMsg({ type: "error", text: "Secondary phone is not valid (11 digits, 0 or +92)." });
    }

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

    if (!pwForm.current || !pwForm.next || !pwForm.confirm) {
      return setPwMsg({ type: "error", text: "Please fill in all password fields." });
    }
    if (pwForm.next.length < 5) {
      return setPwMsg({ type: "error", text: "New password must be at least 5 characters." });
    }
    if (pwForm.next !== pwForm.confirm) {
      return setPwMsg({ type: "error", text: "New passwords do not match." });
    }
    if (pwForm.next === pwForm.current) {
      return setPwMsg({ type: "error", text: "New password must be different from the current one." });
    }

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

  const initials = (profile?.fullName || "U").split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();

  if (loading) {
    return (
      <DashboardLayout title="My Profile">
        <div className="pf-loading"><div className="pf-spinner" /></div>
      </DashboardLayout>
    );
  }

  const eyeIcon = (shown) => shown ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
  );

  const bioLen = form.bio.length;

  return (
    <DashboardLayout title="My Profile">
      <div className="pf-grid">
        {/* LEFT: Profile card */}
        <div className="pf-card">
          <div className="pf-card-banner" />

          <div className="pf-avatar-wrap">
            {photo ? (
              <img src={photo} alt="Profile" className="pf-avatar-img" onClick={() => setViewPhoto(true)} title="Click to view" />
            ) : (
              <div className="pf-avatar">{initials}</div>
            )}
            {savingPhoto && <div className="pf-avatar-loading"><div className="pf-spinner-sm" /></div>}
          </div>

          <div className="pf-photo-actions">
            <button className="pf-photo-btn" onClick={() => fileInputRef.current?.click()} disabled={savingPhoto}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
              {photo ? "Change Photo" : "Upload Photo"}
            </button>
            {photo && (
              <button className="pf-photo-remove" onClick={handleRemovePhoto} disabled={savingPhoto}>
                Remove
              </button>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} style={{ display: "none" }} />

          <h3 className="pf-name">{profile?.fullName}</h3>
          <span className="pf-role">{profile?.role}</span>
          {profile?.bio && <p className="pf-bio">"{profile.bio}"</p>}

          <div className="pf-contact">
            <div className="pf-contact-item">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
              <span>{profile?.email}</span>
            </div>
            {profile?.phone && (
              <div className="pf-contact-item">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                <span>{profile.phone}</span>
              </div>
            )}
            {profile?.secondaryPhone && (
              <div className="pf-contact-item">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                <span>{profile.secondaryPhone} <span className="pf-optional">(secondary)</span></span>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Forms */}
        <div className="pf-forms">
          {/* Profile Information */}
          <div className="pf-section">
            <div className="pf-section-head">
              <h3>Profile Information</h3>
              <p>Update your name, contact details, and bio</p>
            </div>

            {profileMsg.text && <div className={`pf-msg pf-msg-${profileMsg.type}`}>{profileMsg.text}</div>}

            <div className="pf-form-grid">
              <div className="pf-field">
                <label>Full Name <span className="req">*</span></label>
                <input type="text" maxLength={100} value={form.fullName} onChange={(e) => handleFormChange("fullName", e.target.value)} />
              </div>
              <div className="pf-field">
                <label>Username</label>
                <input type="text" value={profile?.username || ""} disabled className="pf-locked" />
                <span className="pf-hint">Username cannot be changed</span>
              </div>
              <div className="pf-field">
                <label>Email <span className="req">*</span></label>
                <input type="email" maxLength={100} value={form.email} onChange={(e) => handleFormChange("email", e.target.value)} />
              </div>
              <div className="pf-field">
                <label>Role</label>
                <input type="text" value={profile?.role || ""} disabled className="pf-locked" />
                <span className="pf-hint">Role is managed by the system</span>
              </div>
              <div className="pf-field">
                <label>Phone <span className="req">*</span></label>
                <input type="text" maxLength={15} placeholder="+92 300 0000000" value={form.phone} onChange={(e) => handleFormChange("phone", e.target.value)} />
              </div>
              <div className="pf-field">
                <label>Secondary Phone</label>
                <input type="text" maxLength={15} placeholder="Optional" value={form.secondaryPhone} onChange={(e) => handleFormChange("secondaryPhone", e.target.value)} />
              </div>
              <div className="pf-field pf-field-full">
                <div className="pf-label-row">
                  <label>Bio</label>
                  <span className={`pf-counter ${bioLen >= 450 ? "warn" : ""}`}>{bioLen}/500</span>
                </div>
                <textarea rows="3" maxLength={500} placeholder="A short description about yourself" value={form.bio} onChange={(e) => handleFormChange("bio", e.target.value)} />
              </div>
            </div>

            <div className="pf-section-actions">
              <button className="pf-btn-save" onClick={handleSaveProfile} disabled={savingProfile}>
                {savingProfile ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>

          {/* Change Password */}
          <div className="pf-section">
            <div className="pf-section-head">
              <h3>Change Password</h3>
              <p>Update your account password</p>
            </div>

            {pwMsg.text && <div className={`pf-msg pf-msg-${pwMsg.type}`}>{pwMsg.text}</div>}

            <div className="pf-form-grid">
              <div className="pf-field pf-field-full">
                <label>Current Password <span className="req">*</span></label>
                <div className="pf-pw-wrap">
                  <input type={showPw.current ? "text" : "password"} value={pwForm.current} onChange={(e) => handlePwChange("current", e.target.value)} />
                  <button type="button" onClick={() => setShowPw({ ...showPw, current: !showPw.current })}>{eyeIcon(showPw.current)}</button>
                </div>
              </div>
              <div className="pf-field">
                <label>New Password <span className="req">*</span></label>
                <div className="pf-pw-wrap">
                  <input type={showPw.next ? "text" : "password"} value={pwForm.next} onChange={(e) => handlePwChange("next", e.target.value)} />
                  <button type="button" onClick={() => setShowPw({ ...showPw, next: !showPw.next })}>{eyeIcon(showPw.next)}</button>
                </div>
                <span className="pf-hint">At least 5 characters</span>
              </div>
              <div className="pf-field">
                <label>Confirm New Password <span className="req">*</span></label>
                <div className="pf-pw-wrap">
                  <input type={showPw.confirm ? "text" : "password"} value={pwForm.confirm} onChange={(e) => handlePwChange("confirm", e.target.value)} />
                  <button type="button" onClick={() => setShowPw({ ...showPw, confirm: !showPw.confirm })}>{eyeIcon(showPw.confirm)}</button>
                </div>
              </div>
            </div>

            <div className="pf-section-actions">
              <button className="pf-btn-save" onClick={handleChangePassword} disabled={savingPw}>
                {savingPw ? "Changing..." : "Change Password"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {cropSrc && (
        <ImageCropModal
          imageSrc={cropSrc}
          onCancel={() => setCropSrc(null)}
          onCrop={handleCropDone}
        />
      )}

      {viewPhoto && photo && (
        <div className="pf-view-overlay" onClick={() => setViewPhoto(false)}>
          <button className="pf-view-close" onClick={() => setViewPhoto(false)} aria-label="Close">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
          <img src={photo} alt="Profile" className="pf-view-img" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </DashboardLayout>
  );
}

export default Profile;
