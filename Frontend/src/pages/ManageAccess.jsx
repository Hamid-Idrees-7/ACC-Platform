import { useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import DashboardLayout from "../components/DashboardLayout";
import { userService } from "../services/userService";
import { permissionService } from "../services/permissionService";
import { MODULE_GROUPS } from "../config/moduleConfig";
import "./ManageAccess.css";
import { useLiveRefresh } from "../hooks/useLive";
import { SkeletonPage } from "../components/Skeleton";
import { useLoader } from "../hooks/useLoader";

function ManageAccess() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [perms, setPerms] = useState({}); // { "Clients:View": {allowed, approval}, ... }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // The toggles are shown only once the user's real access has loaded; an empty map after a
  // failed load would look like "no access" and the next toggle would wipe their rights.
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const pendingSaves = useRef(0);

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
      setLoaded(true);
    } catch {
      setError("Could not load this user's access.");
    } finally {
      setLoading(false);
    }
  };

  useLoader(() => load(), userId);

  useLiveRefresh(["permissions", "users"], async () => {
    try {
      const [userData, permData] = await Promise.all([userService.getById(userId), permissionService.getForUser(userId)]);
      setUser(userData);
      const map = {};
      permData.forEach((p) => {
        map[key(p.module, p.action)] = { allowed: p.isAllowed, approval: p.requiresApproval };
      });
      setPerms(map);
      setLoaded(true);
    } catch {
      return;
    }
  }, { paused: saving });

  const getPerm = (module, action) => perms[key(module, action)] || { allowed: false, approval: false };

  // Saves one permission to the backend straight away. If the save fails, the toggle goes
  // back to what it was, so the screen never shows access the user doesn't have.
  const savePerm = async (module, action, allowed, approval, previous) => {
    pendingSaves.current += 1;
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
      setPerms((prev) => ({ ...prev, [key(module, action)]: previous }));
      setError(`Could not save ${module} ${action}. It was put back; please try again.`);
    } finally {
      pendingSaves.current -= 1;
      if (pendingSaves.current === 0) setSaving(false);
    }
  };

  const toggleAction = (module, action) => {
    const current = getPerm(module, action);
    const newAllowed = !current.allowed;
    const newApproval = newAllowed ? current.approval : false; // reset approval when turning off
    setError("");
    setPerms((prev) => ({ ...prev, [key(module, action)]: { allowed: newAllowed, approval: newApproval } }));
    savePerm(module, action, newAllowed, newApproval, current);
  };

  const toggleApproval = (module, action) => {
    const current = getPerm(module, action);
    if (!current.allowed) return; // approval only matters when action is allowed
    const newApproval = !current.approval;
    setError("");
    setPerms((prev) => ({ ...prev, [key(module, action)]: { allowed: current.allowed, approval: newApproval } }));
    savePerm(module, action, current.allowed, newApproval, current);
  };

  // The module master toggle is View (access to the module). Turning it on grants
  // View only; each action below is then turned on by itself. Turning it off clears
  // View and every action, so no action can stay on without View.
  const toggleModule = (mod) => {
    const turnOn = !isModuleOn(mod);
    const updates = {};
    setError("");
    mod.actions.forEach((a) => {
      const allowed = turnOn && a === "View";
      updates[key(mod.key, a)] = { allowed, approval: false };
      savePerm(mod.key, a, allowed, false, getPerm(mod.key, a));
    });
    setPerms((prev) => ({ ...prev, ...updates }));
  };

  // A module is "on" when the user can View it.
  const isModuleOn = (mod) => getPerm(mod.key, "View").allowed;
  const initials = (name) => (name || "U").charAt(0).toUpperCase();

  if (loading) {
    return (
      <DashboardLayout title="Manage Access">
        <SkeletonPage stats={0} rows={8} />
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

      {!loaded && (
        <div className="ma-load-failed">
          <p>This user's access couldn't be loaded, so it can't be changed right now.</p>
          <button className="ma-retry" onClick={load}>Retry</button>
        </div>
      )}

      {/* Module groups */}
      {loaded && MODULE_GROUPS.map((grp) => (
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
                      <span>{mod.actions.filter((a) => a !== "View").length} actions</span>
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
                      {mod.actions.filter((action) => action !== "View").map((action) => {
                        const p = getPerm(mod.key, action);
                        const canApprove = (mod.approvalActions || []).includes(action);
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
