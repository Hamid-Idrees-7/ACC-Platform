import { useState, useEffect, useMemo } from "react";
import DashboardLayout from "../components/DashboardLayout";
import { usePermissions } from "../context/PermissionContext";
import { clientService } from "../services/clientService";
import ClientFormModal from "../components/ClientFormModal";
import "./Clients.css";

function Clients() {
  const { can } = usePermissions();
  const canAdd = can("Clients", "Add");
  const canEdit = can("Clients", "Edit");
  const canDelete = can("Clients", "Delete");

  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");    // All | External | Internal (via buttons)
  const [statusFilter, setStatusFilter] = useState("All"); // All | Active | Inactive (via cards)

  // Modals
  const [formModal, setFormModal] = useState(null); // { mode, data }
  const [detailClient, setDetailClient] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  // Toast
  const [toast, setToast] = useState(null);
  const showToast = (text, type = "success") => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadClients = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await clientService.getAll();
      // Newest first - clientID is reliable (auto-increment), so sort by it descending
      data.sort((a, b) => b.clientID - a.clientID);
      setClients(data);
    } catch {
      setError("Could not load clients. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadClients(); }, []);

  // Stats (now Total / Active / Inactive)
  const stats = useMemo(() => ({
    total: clients.length,
    active: clients.filter((c) => c.status === "Active").length,
    inactive: clients.filter((c) => c.status === "Inactive").length,
  }), [clients]);

  // Filtered + sorted (inactive always last)
  const filtered = useMemo(() => {
    let list = [...clients];
    if (typeFilter !== "All") list = list.filter((c) => c.clientType === typeFilter);
    if (statusFilter !== "All") list = list.filter((c) => c.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((c) =>
        c.fullName?.toLowerCase().includes(q) ||
        c.phone?.includes(q) ||
        c.cnic?.includes(q) ||
        c.email?.toLowerCase().includes(q)
      );
    }
    // Inactive to the bottom
    list.sort((a, b) => (a.status === "Inactive" ? 1 : 0) - (b.status === "Inactive" ? 1 : 0));
    return list;
  }, [clients, typeFilter, statusFilter, search]);

  // ---- Actions ----
  const handleSave = async (data) => {
    if (formModal.mode === "edit") {
      await clientService.update(formModal.data.clientID, data);
      showToast("Client updated successfully.");
    } else {
      await clientService.create(data);
      showToast("Client added successfully.");
    }
    setFormModal(null);
    loadClients();
  };

  const handleToggleStatus = async (client) => {
    const newStatus = client.status === "Active" ? "Inactive" : "Active";
    try {
      await clientService.update(client.clientID, { ...client, status: newStatus });
      showToast(`Client "${client.fullName}" ${newStatus === "Active" ? "enabled" : "disabled"}.`, newStatus === "Active" ? "success" : "warn");
      setDetailClient(null);
      loadClients();
    } catch {
      showToast("Could not update status.", "error");
    }
  };

  const handleDelete = async (id) => {
    try {
      const res = await clientService.delete(id);
      setConfirmDelete(null);
      setDetailClient(null);
      // If the backend queued an approval request instead of deleting
      if (res?.requiresApproval) {
        // A duplicate request shows a neutral (grey) toast
        showToast(res.message || "Request sent to administration for approval.", res.alreadyPending ? "warn" : "success");
      } else {
        showToast("Client deleted.", "error");
        loadClients();
      }
    } catch {
      showToast("Could not delete client.", "error");
    }
  };

  const initials = (name) => (name || "C").charAt(0).toUpperCase();

  // Stat cards now filter by STATUS (Total / Active / Inactive)
  const statCards = [
    { key: "All", label: "Total Clients", value: loading ? "" : stats.total, icon: "users" },
    { key: "Active", label: "Active", value: loading ? "" : stats.active, icon: "check" },
    { key: "Inactive", label: "Inactive", value: loading ? "" : stats.inactive, icon: "pause" },
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
    <DashboardLayout title="Client Management">
      {/* Stat cards (clickable to filter by status: Total / Active / Inactive) */}
      <div className="cl-stats">
        {statCards.map((s) => (
          <button
            key={s.key}
            className={`cl-stat ${statusFilter === s.key ? "active" : ""} cl-stat-${s.key.toLowerCase()}`}
            onClick={() => setStatusFilter(s.key)}
          >
            <div className="cl-stat-icon">{statIcon(s.icon)}</div>
            <div className="cl-stat-text">
              <div className="cl-stat-value">{s.value}</div>
              <div className="cl-stat-label">{s.label}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Toolbar: search + type filter (All / External / Internal) + add */}
      <div className="cl-toolbar">
        <div className="cl-search">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          <input type="text" placeholder="Search by name, phone, CNIC, or email..." value={search} onChange={(e) => setSearch(e.target.value)} autoComplete="off" name="client-search-box" />
        </div>

        <div className="cl-status-filter">
          {["All", "External", "Internal"].map((t) => (
            <button key={t} className={typeFilter === t ? "active" : ""} onClick={() => setTypeFilter(t)}>{t}</button>
          ))}
        </div>

        {canAdd && (
          <button className="cl-add-btn" onClick={() => setFormModal({ mode: "add" })}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            Add Client
          </button>
        )}
      </div>

      {error && <div className="cl-error">{error}</div>}

      {/* Cards grid */}
      {loading ? (
        <div className="cl-empty"><div className="cl-spinner" /><p>Loading clients...</p></div>
      ) : filtered.length === 0 ? (
        <div className="cl-empty">
          <div className="cl-empty-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" /></svg>
          </div>
          <h3>{clients.length === 0 ? "No clients yet" : "No clients match your filters"}</h3>
          <p>{clients.length === 0 ? "Add your first client to get started." : "Try adjusting your search or filters."}</p>
        </div>
      ) : (
        <div className="cl-grid">
          {filtered.map((c) => (
            <div
              key={c.clientID}
              className={`cl-card ${c.status === "Inactive" ? "inactive" : ""}`}
              onClick={() => setDetailClient(c)}
            >
              {canEdit && (
                <button
                  className="cl-card-edit"
                  onClick={(e) => { e.stopPropagation(); setFormModal({ mode: "edit", data: c }); }}
                  aria-label="Edit"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                </button>
              )}

              <div className={`cl-card-avatar ${c.clientType === "Internal" ? "internal" : "external"}`}>{initials(c.fullName)}</div>
              <h4 className="cl-card-name">{c.fullName}</h4>
              <div className="cl-card-badges">
                <span className={`cl-badge cl-badge-${c.clientType.toLowerCase()}`}>{c.clientType}</span>
                {c.status === "Inactive" && <span className="cl-badge cl-badge-inactive">Inactive</span>}
              </div>
              <div className="cl-card-info">
                <div className="cl-card-info-row">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                  {c.phone}
                </div>
                {c.city && (
                  <div className="cl-card-info-row">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                    {c.city}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit form modal */}
      {formModal && (
        <ClientFormModal
          mode={formModal.mode}
          initialData={formModal.data}
          onClose={() => setFormModal(null)}
          onSave={handleSave}
        />
      )}

      {/* Detail modal */}
      {detailClient && (
        <div className="cl-detail-overlay" onClick={(e) => e.target.classList.contains("cl-detail-overlay") && setDetailClient(null)}>
          <div className="cl-detail">
            <button className="cl-detail-close" onClick={() => setDetailClient(null)} aria-label="Close">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>

            <div className="cl-detail-head">
              <div className={`cl-detail-avatar ${detailClient.clientType === "Internal" ? "internal" : "external"}`}>{initials(detailClient.fullName)}</div>
              <h3>{detailClient.fullName}</h3>
              <div className="cl-card-badges">
                <span className={`cl-badge cl-badge-${detailClient.clientType.toLowerCase()}`}>{detailClient.clientType}</span>
                <span className={`cl-badge ${detailClient.status === "Active" ? "cl-badge-active" : "cl-badge-inactive"}`}>{detailClient.status}</span>
              </div>
            </div>

            <div className="cl-detail-info">
              <div className="cl-detail-row"><span>Phone</span><strong>{detailClient.phone}</strong></div>
              {detailClient.secondaryPhone && <div className="cl-detail-row"><span>Secondary</span><strong>{detailClient.secondaryPhone}</strong></div>}
              <div className="cl-detail-row"><span>CNIC</span><strong>{detailClient.cnic || "—"}</strong></div>
              {detailClient.email && <div className="cl-detail-row"><span>Email</span><strong>{detailClient.email}</strong></div>}
              {detailClient.city && <div className="cl-detail-row"><span>City</span><strong>{detailClient.city}</strong></div>}
              {detailClient.address && <div className="cl-detail-row"><span>Address</span><strong>{detailClient.address}</strong></div>}
            </div>

            {(canEdit || canDelete) && (
              <div className="cl-detail-actions">
                {canEdit && (
                  <button className="cl-detail-edit" onClick={() => { setFormModal({ mode: "edit", data: detailClient }); setDetailClient(null); }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                    Edit
                  </button>
                )}
                {canEdit && (
                  <button className={detailClient.status === "Active" ? "cl-detail-disable" : "cl-detail-enable"} onClick={() => handleToggleStatus(detailClient)}>
                    {detailClient.status === "Active" ? "Disable" : "Enable"}
                  </button>
                )}
                {canDelete && (
                  <button className="cl-detail-delete" onClick={() => setConfirmDelete(detailClient)}>
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
        <div className="cl-detail-overlay" onClick={(e) => e.target.classList.contains("cl-detail-overlay") && setConfirmDelete(null)}>
          <div className="cl-confirm">
            <div className="cl-confirm-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
            </div>
            <h3>Delete this client?</h3>
            <p><strong>{confirmDelete.fullName}</strong> will be permanently deleted. This cannot be undone.</p>
            <div className="cl-confirm-actions">
              <button className="cl-confirm-cancel" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button className="cl-confirm-delete" onClick={() => handleDelete(confirmDelete.clientID)}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`cl-toast cl-toast-${toast.type}`}>{toast.text}</div>
      )}
    </DashboardLayout>
  );
}

export default Clients;
