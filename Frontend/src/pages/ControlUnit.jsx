import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import DashboardLayout from "../components/DashboardLayout";
import { userService } from "../services/userService";
import { permissionService } from "../services/permissionService";
import { ALL_MODULES } from "../config/moduleConfig";
import "./ControlUnit.css";

function ControlUnit() {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const totalModules = ALL_MODULES.length;

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [userData, countData] = await Promise.all([
        userService.getAll(),
        permissionService.getCounts(),
      ]);
      // Exclude the admin's own account - admin always has full access
      const myId = currentUser?.userID ?? currentUser?.userId;
      const others = userData.filter((u) => u.userID !== myId && u.role?.toLowerCase() !== "admin");
      others.sort((a, b) => b.userID - a.userID);
      setUsers(others);
      setCounts(countData || {});
    } catch {
      setError("Could not load users. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const initials = (name) => (name || "U").charAt(0).toUpperCase();

  return (
    <DashboardLayout title="Control Unit — Access Management">
      <div className="cu-head">
        <h2>Module Access</h2>
        <p>Select a user to manage what they can see and do.</p>
      </div>

      {error && <div className="cu-error">{error}</div>}

      {loading ? (
        <div className="cu-empty"><div className="cu-spinner" /><p>Loading users...</p></div>
      ) : users.length === 0 ? (
        <div className="cu-empty">
          <div className="cu-empty-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
          </div>
          <h3>No users to manage</h3>
          <p>Create users first, then assign their access here.</p>
        </div>
      ) : (
        <div className="cu-grid">
          {users.map((u) => {
            const count = counts[u.userID] || 0;
            const pct = totalModules ? Math.round((count / totalModules) * 100) : 0;
            return (
              <div key={u.userID} className="cu-card">
                <div className="cu-card-avatar">
                  {u.profilePicture ? <img src={u.profilePicture} alt="" /> : initials(u.fullName)}
                </div>
                <h4 className="cu-card-name">{u.fullName}</h4>
                <span className="cu-card-role">{u.role}</span>
                <span className="cu-card-username">@{u.username}</span>

                <div className="cu-progress">
                  <div className="cu-progress-bar" style={{ width: `${pct}%` }} />
                </div>
                <span className="cu-progress-text">{count} of {totalModules} modules</span>

                <button className="cu-manage-btn" onClick={() => navigate(`/dashboard/control-unit/${u.userID}`)}>
                  Manage Access
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </DashboardLayout>
  );
}

export default ControlUnit;
