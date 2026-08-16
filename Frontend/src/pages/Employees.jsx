import { useState, useEffect, useMemo } from "react";
import DashboardLayout from "../components/DashboardLayout";
import { usePermissions } from "../context/PermissionContext";
import { employeeService } from "../services/employeeService";
import EmployeeFormModal from "../components/EmployeeFormModal";
import { formatDate } from "../components/DatePicker";
import "./Employees.css";

function Employees() {
  const { can } = usePermissions();
  const canAdd = can("Employees", "Add");
  const canEdit = can("Employees", "Edit");
  const canDelete = can("Employees", "Delete");

  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All"); // via cards: All | Active | Inactive
  const [designationFilter, setDesignationFilter] = useState("All");

  // Modals
  const [formModal, setFormModal] = useState(null);
  const [detailEmp, setDetailEmp] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  // Toast
  const [toast, setToast] = useState(null);
  const showToast = (text, type = "success") => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadEmployees = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await employeeService.getAll();
      data.sort((a, b) => b.employeeID - a.employeeID);
      setEmployees(data);
    } catch {
      setError("Could not load employees. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadEmployees(); }, []);

  const stats = useMemo(() => ({
    total: employees.length,
    active: employees.filter((e) => e.status === "Active").length,
    inactive: employees.filter((e) => e.status === "Inactive").length,
  }), [employees]);

  // Unique designations for the filter dropdown
  const designations = useMemo(() => {
    const set = new Set(employees.map((e) => e.designation).filter(Boolean));
    return Array.from(set).sort();
  }, [employees]);

  const filtered = useMemo(() => {
    let list = [...employees];
    if (statusFilter !== "All") list = list.filter((e) => e.status === statusFilter);
    if (designationFilter !== "All") list = list.filter((e) => e.designation === designationFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((e) =>
        e.fullName?.toLowerCase().includes(q) ||
        e.phone?.includes(q) ||
        e.cnic?.includes(q) ||
        e.email?.toLowerCase().includes(q) ||
        e.designation?.toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => (a.status === "Inactive" ? 1 : 0) - (b.status === "Inactive" ? 1 : 0));
    return list;
  }, [employees, statusFilter, designationFilter, search]);

  // ---- Actions ----
  const handleSave = async (data) => {
    if (formModal.mode === "edit") {
      await employeeService.update(formModal.data.employeeID, data);
      showToast("Employee updated successfully.");
    } else {
      await employeeService.create(data);
      showToast("Employee added successfully.");
    }
    setFormModal(null);
    loadEmployees();
  };

  const handleToggleStatus = async (emp) => {
    const newStatus = emp.status === "Active" ? "Inactive" : "Active";
    try {
      await employeeService.update(emp.employeeID, { ...emp, status: newStatus, joiningDate: emp.joiningDate ? emp.joiningDate.split("T")[0] : null });
      showToast(`Employee "${emp.fullName}" ${newStatus === "Active" ? "enabled" : "disabled"}.`, newStatus === "Active" ? "success" : "warn");
      setDetailEmp(null);
      loadEmployees();
    } catch {
      showToast("Could not update status.", "error");
    }
  };

  const handleDelete = async (id) => {
    try {
      await employeeService.delete(id);
      showToast("Employee deleted.", "error");
      setConfirmDelete(null);
      setDetailEmp(null);
      loadEmployees();
    } catch {
      showToast("Could not delete employee.", "error");
    }
  };

  const initials = (name) => (name || "E").charAt(0).toUpperCase();

  const statCards = [
    { key: "All", label: "Total Employees", value: stats.total, icon: "users" },
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
    <DashboardLayout title="Employee Management">
      {/* Stat cards (Total / Active / Inactive) */}
      <div className="emp-stats">
        {statCards.map((s) => (
          <button
            key={s.key}
            className={`emp-stat ${statusFilter === s.key ? "active" : ""} emp-stat-${s.key.toLowerCase()}`}
            onClick={() => setStatusFilter(s.key)}
          >
            <div className="emp-stat-icon">{statIcon(s.icon)}</div>
            <div className="emp-stat-text">
              <div className="emp-stat-value">{loading ? "" : s.value}</div>
              <div className="emp-stat-label">{s.label}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Toolbar: search + designation dropdown + add */}
      <div className="emp-toolbar">
        <div className="emp-search">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          <input type="text" placeholder="Search by name, phone, CNIC, email, or designation..." value={search} onChange={(e) => setSearch(e.target.value)} autoComplete="off" name="emp-search-box" />
        </div>

        <select className="emp-designation-filter" value={designationFilter} onChange={(e) => setDesignationFilter(e.target.value)}>
          <option value="All">All Designations</option>
          {designations.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>

        {canAdd && (
          <button className="emp-add-btn" onClick={() => setFormModal({ mode: "add" })}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            Add Employee
          </button>
        )}
      </div>

      {error && <div className="emp-error">{error}</div>}

      {/* Cards grid */}
      {loading ? (
        <div className="emp-empty"><div className="emp-spinner" /><p>Loading employees...</p></div>
      ) : filtered.length === 0 ? (
        <div className="emp-empty">
          <div className="emp-empty-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
          </div>
          <h3>{employees.length === 0 ? "No employees yet" : "No employees match your filters"}</h3>
          <p>{employees.length === 0 ? "Add your first employee to get started." : "Try adjusting your search or filters."}</p>
        </div>
      ) : (
        <div className="emp-grid">
          {filtered.map((emp) => (
            <div
              key={emp.employeeID}
              className={`emp-card ${emp.status === "Inactive" ? "inactive" : ""}`}
              onClick={() => setDetailEmp(emp)}
            >
              {canEdit && (
                <button
                  className="emp-card-edit"
                  onClick={(e) => { e.stopPropagation(); setFormModal({ mode: "edit", data: emp }); }}
                  aria-label="Edit"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                </button>
              )}

              <div className="emp-card-avatar">{initials(emp.fullName)}</div>
              <h4 className="emp-card-name">{emp.fullName}</h4>
              <div className="emp-card-badges">
                <span className="emp-badge emp-badge-designation">{emp.designation}</span>
                {emp.status === "Inactive" && <span className="emp-badge emp-badge-inactive">Inactive</span>}
              </div>
              <div className="emp-card-info">
                <div className="emp-card-info-row">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                  {emp.phone}
                </div>
                {emp.city && (
                  <div className="emp-card-info-row">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                    {emp.city}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit form modal */}
      {formModal && (
        <EmployeeFormModal
          mode={formModal.mode}
          initialData={formModal.data}
          existingDesignations={designations}
          onClose={() => setFormModal(null)}
          onSave={handleSave}
        />
      )}

      {/* Detail modal */}
      {detailEmp && (
        <div className="emp-detail-overlay" onClick={(e) => e.target.classList.contains("emp-detail-overlay") && setDetailEmp(null)}>
          <div className="emp-detail">
            <button className="emp-detail-close" onClick={() => setDetailEmp(null)} aria-label="Close">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>

            <div className="emp-detail-head">
              <div className="emp-detail-avatar">{initials(detailEmp.fullName)}</div>
              <h3>{detailEmp.fullName}</h3>
              <div className="emp-card-badges">
                <span className="emp-badge emp-badge-designation">{detailEmp.designation}</span>
                <span className={`emp-badge ${detailEmp.status === "Active" ? "emp-badge-active" : "emp-badge-inactive"}`}>{detailEmp.status}</span>
              </div>
            </div>

            <div className="emp-detail-info">
              <div className="emp-detail-row"><span>Phone</span><strong>{detailEmp.phone}</strong></div>
              {detailEmp.secondaryPhone && <div className="emp-detail-row"><span>Secondary</span><strong>{detailEmp.secondaryPhone}</strong></div>}
              {detailEmp.cnic && <div className="emp-detail-row"><span>CNIC</span><strong>{detailEmp.cnic}</strong></div>}
              {detailEmp.email && <div className="emp-detail-row"><span>Email</span><strong>{detailEmp.email}</strong></div>}
              {detailEmp.city && <div className="emp-detail-row"><span>City</span><strong>{detailEmp.city}</strong></div>}
              {detailEmp.address && <div className="emp-detail-row"><span>Address</span><strong>{detailEmp.address}</strong></div>}
              {detailEmp.joiningDate && <div className="emp-detail-row"><span>Joined</span><strong>{formatDate(detailEmp.joiningDate)}</strong></div>}
            </div>

            {(canEdit || canDelete) && (
              <div className="emp-detail-actions">
                {canEdit && (
                  <button className="emp-detail-edit" onClick={() => { setFormModal({ mode: "edit", data: detailEmp }); setDetailEmp(null); }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                    Edit
                  </button>
                )}
                {canEdit && (
                  <button className={detailEmp.status === "Active" ? "emp-detail-disable" : "emp-detail-enable"} onClick={() => handleToggleStatus(detailEmp)}>
                    {detailEmp.status === "Active" ? "Disable" : "Enable"}
                  </button>
                )}
                {canDelete && (
                  <button className="emp-detail-delete" onClick={() => setConfirmDelete(detailEmp)}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                    Delete
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="emp-detail-overlay" onClick={(e) => e.target.classList.contains("emp-detail-overlay") && setConfirmDelete(null)}>
          <div className="emp-confirm">
            <div className="emp-confirm-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
            </div>
            <h3>Delete this employee?</h3>
            <p><strong>{confirmDelete.fullName}</strong> will be permanently deleted. This cannot be undone.</p>
            <div className="emp-confirm-actions">
              <button className="emp-confirm-cancel" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button className="emp-confirm-delete" onClick={() => handleDelete(confirmDelete.employeeID)}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && <div className={`emp-toast emp-toast-${toast.type}`}>{toast.text}</div>}
    </DashboardLayout>
  );
}

export default Employees;
