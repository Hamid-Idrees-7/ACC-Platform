import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import DashboardLayout from "../components/DashboardLayout";
import { profileService } from "../services/profileService";
import "./Profile.css";

// A read-only profile view. Editing happens in Settings.
function Profile() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewPhoto, setViewPhoto] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await profileService.get();
        setProfile(data);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const initials = (profile?.fullName || "U").split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
  const photo = profile?.profilePicture || null;

  if (loading) {
    return (
      <DashboardLayout title="Profile">
        <div className="pf-loading"><div className="pf-spinner" /></div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Profile">
      <div className="pfv-wrap">
        <div className="pfv-card">
          <div className="pfv-banner" />

          <div className="pfv-avatar-wrap">
            {photo ? (
              <img src={photo} alt="Profile" className="pfv-avatar-img" onClick={() => setViewPhoto(true)} title="Click to view" />
            ) : (
              <div className="pfv-avatar">{initials}</div>
            )}
          </div>

          <h2 className="pfv-name">{profile?.fullName}</h2>
          <span className="pfv-role">{profile?.role}</span>
          {profile?.bio && <p className="pfv-bio">"{profile.bio}"</p>}

          <div className="pfv-info">
            <div className="pfv-info-row">
              <span className="pfv-info-label">Username</span>
              <span className="pfv-info-value">@{profile?.username}</span>
            </div>
            <div className="pfv-info-row">
              <span className="pfv-info-label">Email</span>
              <span className="pfv-info-value">{profile?.email}</span>
            </div>
            {profile?.phone && (
              <div className="pfv-info-row">
                <span className="pfv-info-label">Phone</span>
                <span className="pfv-info-value">{profile.phone}</span>
              </div>
            )}
            {profile?.secondaryPhone && (
              <div className="pfv-info-row">
                <span className="pfv-info-label">Secondary Phone</span>
                <span className="pfv-info-value">{profile.secondaryPhone}</span>
              </div>
            )}
          </div>

          <button className="pfv-edit-btn" onClick={() => navigate("/dashboard/settings")}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
            Edit in Settings
          </button>
        </div>
      </div>

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
