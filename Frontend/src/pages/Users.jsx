import { useState, useEffect, useMemo, startTransition } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../components/DashboardLayout";
import { userService } from "../services/userService";
import { demoService } from "../services/demoService";
import { builtInDemoRoleFor, CUSTOM_DEMO_ROLE } from "../config/demoConfig";
import UserFormModal from "../components/UserFormModal";
import { useAuth } from "../context/AuthContext";
import "./Users.css";

function Users() {
  const { user: currentUser, login, runDemoTransition } = useAuth();
  const navigate = useNavigate();

  // Live demo only: the visitor can see the system exactly as any user in their demo
  const inDemo = !!currentUser?.demo;

  // Live demo: the three built-in demo logins are locked (username, password, role, status),
  // so the role switcher always works. Their access can still be changed in Control Unit.
  const isLockedDemoLogin = (u) => inDemo && !!builtInDemoRoleFor(u?.username);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [roleFilter, setRoleFilter] = useState("All");

  // Modals
  const [formModal, setFormModal] = useState(null);
  const [detailUser, setDetailUser] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  // Toast
  const [toast, setToast] = useState(null);
  const showToast = (text, type = "success") => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadUsers = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await userService.getAll();
      data.sort((a, b) => b.userID - a.userID);
      setUsers(data);
    } catch {
      setError("Could not load users. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadUsers(); }, []);

  // Is this the currently logged-in user's own account?
  const isSelf = (u) => {
    if (!currentUser || !u) return false;
    const myId = currentUser.userID ?? currentUser.userId;
    return u.userID === myId;
  };

  const stats = useMemo(() => ({
    total: users.length,
    active: users.filter((u) => u.isActive).length,
    inactive: users.filter((u) => !u.isActive).length,
  }), [users]);

  const roles = useMemo(() => {
    const set = new Set(users.map((u) => u.role).filter(Boolean));
    return Array.from(set).sort();
  }, [users]);

  const filtered = useMemo(() => {
    let list = [...users];
    if (statusFilter === "Active") list = list.filter((u) => u.isActive);
    else if (statusFilter === "Inactive") list = list.filter((u) => !u.isActive);
    if (roleFilter !== "All") list = list.filter((u) => u.role === roleFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((u) =>
        u.fullName?.toLowerCase().includes(q) ||
        u.username?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.role?.toLowerCase().includes(q) ||
        u.phone?.includes(q)
      );
    }
    list.sort((a, b) => {
      // Your own account is always pinned to the top
      if (isSelf(a)) return -1;
      if (isSelf(b)) return 1;
      // Then inactive users sink to the bottom
      return (a.isActive ? 0 : 1) - (b.isActive ? 0 : 1);
    });
    return list;
  }, [users, statusFilter, roleFilter, search]);

  // ---- Actions ----
  const handleSave = async (data) => {
    if (formModal.mode === "edit") {
      await userService.update(formModal.data.userID, data);
      showToast("User updated successfully.");
    } else {
      await userService.create(data);
      showToast("User added successfully.");
    }
    setFormModal(null);
    loadUsers();
  };

  const handleToggleStatus = async (u) => {
    try {
      await userService.toggleStatus(u.userID);
      const nowActive = !u.isActive;
      showToast(`User "${u.fullName}" ${nowActive ? "enabled" : "disabled"}.`, nowActive ? "success" : "warn");
      setDetailUser(null);
      loadUsers();
    } catch (err) {
      showToast(err.response?.data?.message || "Could not update status.", "error");
    }
  };

  const handleDelete = async (id) => {
    try {
      await userService.delete(id);
      showToast("User deleted.", "error");
      setConfirmDelete(null);
      setDetailUser(null);
      loadUsers();
    } catch (err) {
      showToast(err.response?.data?.message || "Could not delete user.", "error");
    }
  };

  // Live demo: open the system as this user (same demo data, same timer).
  const handleViewAs = async (u) => {
    setDetailUser(null);
    const builtIn = builtInDemoRoleFor(u.username);
    try {
      await runDemoTransition(
        builtIn ? builtIn.key : CUSTOM_DEMO_ROLE.key,
        builtIn ? "Switching to" : "Viewing as",
        async () => {
          const data = await demoService.viewAs(u.userID);
          // User and page change in one render, so this page never reloads as the new user.
          startTransition(() => {
            login(data);
            navigate("/dashboard");
          });
        },
        builtIn ? null : u.fullName
      );
    } catch (err) {
      if (err.response?.status === 401) return;   // demo over: the layout signs the visitor out
      showToast(err.response?.data?.message || "Couldn't open this user's view.", "error");
    }
  };

  const initials = (name) => (name || "U").charAt(0).toUpperCase();

  const statCards = [
    { key: "All", label: "Total Users", value: stats.total, icon: "users" },
    { key: "Active", label: "Active", value: stats.active, icon: "check" },
    { key: "Inactive", label: "Inactive", value: stats.inactive, icon: "pause" },
  ];

  const statIcon = (name) => {
    const i = {
      users: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
      check: <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></>,
      pause: <><circle cx="12" cy="12" r="10" /><line x1="10" y1="15" x2="10" y2="9" /><line x1="14" y1="15" x2="14" y2="9" /></>,
    };
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{i[name]}</svg>;
  };

  return (
    <DashboardLayout title="User Management">
      {/* Stat cards */}
      <div className="us-stats">
        {statCards.map((s) => (
          <button
            key={s.key}
            className={`us-stat ${statusFilter === s.key ? "active" : ""} us-stat-${s.key.toLowerCase()}`}
            onClick={() => setStatusFilter(s.key)}
          >
            <div className="us-stat-icon">{statIcon(s.icon)}</div>
            <div className="us-stat-text">
              <div className="us-stat-value">{loading ? "" : s.value}</div>
              <div className="us-stat-label">{s.label}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="us-toolbar">
        <div className="us-search">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          <input type="text" placeholder="Search by name, username, email, or role..." value={search} onChange={(e) => setSearch(e.target.value)} autoComplete="off" name="user-search-box" />
        </div>

        <select className="us-role-filter" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="All">All Roles</option>
          {roles.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>

        <button className="us-add-btn" onClick={() => setFormModal({ mode: "add" })}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          Add User
        </button>
      </div>

      {error && <div className="us-error">{error}</div>}

      {/* Cards grid */}
      {loading ? (
        <div className="us-empty"><div className="us-spinner" /><p>Loading users...</p></div>
      ) : filtered.length === 0 ? (
        <div className="us-empty">
          <div className="us-empty-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
          </div>
          <h3>{users.length === 0 ? "No users yet" : "No users match your filters"}</h3>
          <p>{users.length === 0 ? "Add your first user to get started." : "Try adjusting your search or filters."}</p>
        </div>
      ) : (
        <div className="us-grid">
          {filtered.map((u) => (
            <div
              key={u.userID}
              className={`us-card ${!u.isActive ? "inactive" : ""}`}
              onClick={() => setDetailUser(u)}
            >
              {!isSelf(u) && !isLockedDemoLogin(u) && (
                <button
                  className="us-card-edit"
                  onClick={(e) => { e.stopPropagation(); setFormModal({ mode: "edit", data: u }); }}
                  aria-label="Edit"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                </button>
              )}
                            <div className="us-card-avatar">
                {u.profilePicture ? <img src={u.profilePicture} alt="" /> : initials(u.fullName)}
              </div>
              <h4 className="us-card-name">{u.fullName}</h4>
              <div className="us-card-badges">
                <span className={`us-badge us-badge-role ${isSelf(u) ? "us-badge-gold" : ""}`}>{u.role}</span>
                {!u.isActive && <span className="us-badge us-badge-inactive">Inactive</span>}
              </div>
              <div className="us-card-info">
                <div className="us-card-info-row">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
                  {u.email}
                </div>
                <div className="us-card-info-row">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2" /></svg>
                  @{u.username}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit form modal */}
      {formModal && (
        <UserFormModal
          mode={formModal.mode}
          initialData={formModal.data}
          existingRoles={roles}
          onClose={() => setFormModal(null)}
          onSave={handleSave}
        />
      )}

      {/* Detail modal */}
      {detailUser && (
        <div className="us-detail-overlay" onClick={(e) => e.target.classList.contains("us-detail-overlay") && setDetailUser(null)}>
          <div className="us-detail">
            <button className="us-detail-close" onClick={() => setDetailUser(null)} aria-label="Close">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>

            <div className="us-detail-head">
              <div className="us-detail-avatar">
                {detailUser.profilePicture ? <img src={detailUser.profilePicture} alt="" /> : initials(detailUser.fullName)}
              </div>
              <h3>{detailUser.fullName}</h3>
              <div className="us-card-badges">
                <span className={`us-badge us-badge-role ${isSelf(detailUser) ? "us-badge-gold" : ""}`}>{detailUser.role}</span>
                <span className={`us-badge ${detailUser.isActive ? "us-badge-active" : "us-badge-inactive"}`}>{detailUser.isActive ? "Active" : "Inactive"}</span>
              </div>
            </div>

            <div className="us-detail-info">
              <div className="us-detail-row"><span>Username</span><strong>@{detailUser.username}</strong></div>
              <div className="us-detail-row"><span>Email</span><strong>{detailUser.email}</strong></div>
              {detailUser.phone && <div className="us-detail-row"><span>Phone</span><strong>{detailUser.phone}</strong></div>}
              {detailUser.secondaryPhone && <div className="us-detail-row"><span>Secondary</span><strong>{detailUser.secondaryPhone}</strong></div>}
            </div>

            {/* Your own account has no actions here - managed securely from Settings */}
            {/* Live demo: see the system through this user's eyes */}
            {inDemo && !isSelf(detailUser) && detailUser.isActive && (
              <button className="us-view-as" onClick={() => handleViewAs(detailUser)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                {builtInDemoRoleFor(detailUser.username)
                  ? `Switch to ${builtInDemoRoleFor(detailUser.username).label}`
                  : `View as ${detailUser.fullName.split(" ")[0]}`}
                <span className="us-view-as-hint">sees only their Control Unit access</span>
              </button>
            )}

            {isSelf(detailUser) ? (
              <p className="us-self-note">Manage your profile, username, and password from Settings.</p>
            ) : isLockedDemoLogin(detailUser) ? (
              <div className="us-demo-locked">
                <p>
                  Built-in demo login: username, password, role and status stay fixed so the role
                  switcher always works. You can still change what it can access.
                </p>
                <button
                  className="us-detail-edit"
                  onClick={() => { setDetailUser(null); navigate(`/dashboard/control-unit/${detailUser.userID}`); }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                  Manage access in Control Unit
                </button>
              </div>
            ) : (
              <div className="us-detail-actions">
                <button className="us-detail-edit" onClick={() => { setFormModal({ mode: "edit", data: detailUser }); setDetailUser(null); }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                  Edit
                </button>
                <button className={detailUser.isActive ? "us-detail-disable" : "us-detail-enable"} onClick={() => handleToggleStatus(detailUser)}>
                  {detailUser.isActive ? "Disable" : "Enable"}
                </button>
                <button className="us-detail-delete" onClick={() => setConfirmDelete(detailUser)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="us-detail-overlay" onClick={(e) => e.target.classList.contains("us-detail-overlay") && setConfirmDelete(null)}>
          <div className="us-confirm">
            <div className="us-confirm-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
            </div>
            <h3>Delete this user?</h3>
            <p><strong>{confirmDelete.fullName}</strong> will be permanently deleted. This cannot be undone.</p>
            <div className="us-confirm-actions">
              <button className="us-confirm-cancel" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button className="us-confirm-delete" onClick={() => handleDelete(confirmDelete.userID)}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && <div className={`us-toast us-toast-${toast.type}`}>{toast.text}</div>}
    </DashboardLayout>
  );
}

export default Users;
