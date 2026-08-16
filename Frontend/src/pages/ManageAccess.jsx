import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import DashboardLayout from "../components/DashboardLayout";
import { userService } from "../services/userService";
import { permissionService } from "../services/permissionService";
import { MODULE_GROUPS, APPROVAL_ACTIONS } from "../config/moduleConfig";
import "./ManageAccess.css";

function ManageAccess() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [perms, setPerms] = useState({}); // { "Clients:View": {allowed, approval}, ... }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const key = (module, action) => `${module}:${action}`;

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [userData, permData] = await Promise.all([
        userService.getById(userId),
        permissionService.getForUser(userId),
      ]);
      setUser(userData);
      const map = {};
      permData.forEach((p) => {
        map[key(p.module, p.action)] = { allowed: p.isAllowed, approval: p.requiresApproval };
      });
      setPerms(map);
    } catch {
      setError("Could not load this user's access.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [userId]);

  const getPerm = (module, action) => perms[key(module, action)] || { allowed: false, approval: false };

  // Save one permission to the backend (instant)
  const savePerm = async (module, action, allowed, approval) => {
    setSaving(true);
    try {
      await permissionService.set({
        userID: Number(userId),
        module,
        action,
        isAllowed: allowed,
        requiresApproval: approval,
      });
    } catch {
      setError("Could not save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // Toggle a single action
  const toggleAction = (module, action) => {
    const current = getPerm(module, action);
    const newAllowed = !current.allowed;
    const newApproval = newAllowed ? current.approval : false; // reset approval when turning off
    setPerms((prev) => ({ ...prev, [key(module, action)]: { allowed: newAllowed, approval: newApproval } }));
    savePerm(module, action, newAllowed, newApproval);
  };

  // Toggle the approval-needed checkbox for an action
  const toggleApproval = (module, action) => {
    const current = getPerm(module, action);
    if (!current.allowed) return; // approval only matters when action is allowed
    const newApproval = !current.approval;
    setPerms((prev) => ({ ...prev, [key(module, action)]: { allowed: current.allowed, approval: newApproval } }));
    savePerm(module, action, current.allowed, newApproval);
  };

  // Master toggle: turn whole module on (all actions) or off
  const toggleModule = (mod) => {
    const allOn = mod.actions.every((a) => getPerm(mod.key, a).allowed);
    const newAllowed = !allOn;
    const updates = {};
    mod.actions.forEach((a) => {
      const current = getPerm(mod.key, a);
      const newApproval = newAllowed ? current.approval : false;
      updates[key(mod.key, a)] = { allowed: newAllowed, approval: newApproval };
      savePerm(mod.key, a, newAllowed, newApproval);
    });
    setPerms((prev) => ({ ...prev, ...updates }));
  };

  const isModuleOn = (mod) => mod.actions.some((a) => getPerm(mod.key, a).allowed);
  const initials = (name) => (name || "U").charAt(0).toUpperCase();

  if (loading) {
    return (
      <DashboardLayout title="Manage Access">
        <div className="ma-empty"><div className="ma-spinner" /></div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title={`Access — ${user?.fullName || ""}`}>
      <button className="ma-back" onClick={() => navigate("/dashboard/control-unit")}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
        Back to Control Unit
      </button>

      {/* User header */}
      <div className="ma-user-head">
        <div className="ma-user-avatar">
          {user?.profilePicture ? <img src={user.profilePicture} alt="" /> : initials(user?.fullName)}
        </div>
        <div className="ma-user-info">
          <h3>{user?.fullName}</h3>
          <div className="ma-user-meta">
            <span className="ma-user-role">{user?.role}</span>
            <span>@{user?.username}</span>
            <span>{user?.email}</span>
          </div>
        </div>
        <span className="ma-save-note">{saving ? "Saving..." : "Changes save instantly"}</span>
      </div>

      {error && <div className="ma-error">{error}</div>}

      {/* Module groups */}
      {MODULE_GROUPS.map((grp) => (
        <div key={grp.group} className="ma-group">
          <div className="ma-group-title">{grp.group}</div>
          <div className="ma-modules">
            {grp.modules.map((mod) => {
              const on = isModuleOn(mod);
              return (
                <div key={mod.key} className={`ma-module ${on ? "on" : ""}`}>
                  <div className="ma-module-head">
                    <div>
                      <h4>{mod.label}</h4>
                      <span>{mod.actions.length} actions</span>
                    </div>
                    <button
                      className={`ma-toggle ${on ? "on" : ""}`}
                      onClick={() => toggleModule(mod)}
                      aria-label="Toggle module"
                    >
                      <span className="ma-toggle-knob" />
                    </button>
                  </div>

                  {on && (
                    <div className="ma-actions">
                      {mod.actions.map((action) => {
                        const p = getPerm(mod.key, action);
                        const canApprove = APPROVAL_ACTIONS.includes(action);
                        return (
                          <div key={action} className="ma-action-row">
                            <button
                              className={`ma-toggle sm ${p.allowed ? "on" : ""}`}
                              onClick={() => toggleAction(mod.key, action)}
                              aria-label={`Toggle ${action}`}
                            >
                              <span className="ma-toggle-knob" />
                            </button>
                            <span className="ma-action-label">{action}</span>

                            {canApprove && p.allowed && (
                              <label className="ma-approval">
                                <input
                                  type="checkbox"
                                  checked={p.approval}
                                  onChange={() => toggleApproval(mod.key, action)}
                                />
                                <span>Approval needed</span>
                              </label>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </DashboardLayout>
  );
}

export default ManageAccess;
