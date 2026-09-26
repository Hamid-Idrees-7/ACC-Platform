import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../components/DashboardLayout";
import { usePermissions } from "../context/PermissionContext";
import { materialService } from "../services/materialService";
import { projectService } from "../services/projectService";
import MaterialFormModal from "../components/MaterialFormModal";
import StockModal from "../components/StockModal";
import { formatQty, rupees, rupeesShort, rupeesPK, amountInWords } from "../utils/format";
import "./Materials.css";

function Materials() {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const canAdd = can("Materials", "Add");
  const canEdit = can("Materials", "Edit");
  const canDelete = can("Materials", "Delete");
  const canManage = can("Materials", "Manage");

  const [materials, setMaterials] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [stockFilter, setStockFilter] = useState("All"); // All | Out

  // Modals
  const [formModal, setFormModal] = useState(null);
  const [stockModal, setStockModal] = useState(null); // { mode, material }
  const [confirmDelete, setConfirmDelete] = useState(null);

  // Toast
  const [toast, setToast] = useState(null);
  const showToast = (text, type = "success") => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3000);
  };

  // The first load shows the spinner. Reloads after a change ({ quiet: true }) keep the
  // page on screen, so it never jumps back to the top.
  const loadMaterials = async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    setError("");
    try {
      const data = await materialService.getAll();
      data.sort((a, b) => b.materialID - a.materialID);
      setMaterials(data);
    } catch {
      if (quiet) showToast("Could not refresh. Please reload the page.", "error");
      else setError("Could not load materials. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const loadProjects = async () => {
    try {
      const data = await projectService.getAll();
      setProjects(Array.isArray(data) ? data : []);
    } catch {
      setProjects([]);
    }
  };

  useEffect(() => { loadMaterials(); loadProjects(); }, []);

  const isOut = (m) => Number(m.currentStock) <= 0;
  const isLow = (m) => Number(m.currentStock) > 0 && Number(m.currentStock) <= Number(m.lowStockThreshold);

  const stats = useMemo(() => ({
    total: materials.length,
    lowCount: materials.filter(isLow).length,
    outCount: materials.filter(isOut).length,
    inventoryValue: materials.reduce((sum, m) => sum + (Number(m.stockValue) || 0), 0),
  }), [materials]);

  const categories = useMemo(() => {
    const set = new Set(materials.map((m) => m.category).filter(Boolean));
    return Array.from(set).sort();
  }, [materials]);

  const units = useMemo(() => {
    const set = new Set(materials.map((m) => m.unit).filter(Boolean));
    return Array.from(set).sort();
  }, [materials]);

  const filtered = useMemo(() => {
    let list = [...materials];
    if (stockFilter === "Low") list = list.filter(isLow);
    if (stockFilter === "Out") list = list.filter(isOut);
    if (categoryFilter !== "All") list = list.filter((m) => m.category === categoryFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((m) => m.name?.toLowerCase().includes(q) || m.category?.toLowerCase().includes(q));
    }
    return list;
  }, [materials, stockFilter, categoryFilter, search]);

  // ---- Actions ----
  const handleSave = async (data) => {
    if (formModal.mode === "edit") {
      await materialService.update(formModal.data.materialID, data);
      showToast("Material updated successfully.");
    } else {
      await materialService.create(data);
      showToast("Material added successfully.");
    }
    setFormModal(null);
    loadMaterials({ quiet: true });
  };

  const handleStock = async (data) => {
    const { mode, material } = stockModal;
    if (mode === "restock") {
      await materialService.restock(material.materialID, data);
      showToast(`Restocked ${formatQty(data.quantity)} ${material.unit} of ${material.name}.`);
    } else {
      await materialService.issue(material.materialID, data);
      showToast(`Issued ${formatQty(data.quantity)} ${material.unit} to ${data.projectName}.`);
    }
    setStockModal(null);
    loadMaterials({ quiet: true });
  };

  const handleDelete = async (id) => {
    try {
      const res = await materialService.delete(id);
      setConfirmDelete(null);
      if (res?.requiresApproval) {
        showToast(res.message || "Request sent to administration for approval.", res.alreadyPending ? "warn" : "success");
      } else {
        showToast("Material deleted.", "error");
        loadMaterials({ quiet: true });
      }
    } catch (err) {
      showToast(err.response?.data?.message || "Could not delete material.", "error");
    }
  };

  const statIcon = (name) => {
    const i = {
      box: <><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></>,
      alert: <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></>,
      dollar: <><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></>,
    };
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{i[name]}</svg>;
  };

  return (
    <DashboardLayout title="Material Inventory">
      {/* Stat cards */}
      <div className="mat-stats">
        <button
          className={`mat-stat mat-stat-total ${stockFilter === "All" ? "active" : ""}`}
          onClick={() => setStockFilter("All")}
        >
          <div className="mat-stat-icon">{statIcon("box")}</div>
          <div className="mat-stat-text">
            <div className="mat-stat-value">{loading ? "" : stats.total}</div>
            <div className="mat-stat-label">Total Materials</div>
          </div>
        </button>

        <button
          className={`mat-stat mat-stat-low ${stockFilter === "Low" ? "active" : ""}`}
          onClick={() => setStockFilter("Low")}
        >
          <div className="mat-stat-icon">{statIcon("alert")}</div>
          <div className="mat-stat-text">
            <div className="mat-stat-value">{loading ? "" : stats.lowCount}</div>
            <div className="mat-stat-label">Low Stock</div>
          </div>
        </button>

        <button
          className={`mat-stat mat-stat-out ${stockFilter === "Out" ? "active" : ""}`}
          onClick={() => setStockFilter("Out")}
        >
          <div className="mat-stat-icon">{statIcon("alert")}</div>
          <div className="mat-stat-text">
            <div className="mat-stat-value">{loading ? "" : stats.outCount}</div>
            <div className="mat-stat-label">Out of Stock</div>
          </div>
        </button>

        <div className="mat-stat mat-stat-value-card no-click">
          <div className="mat-stat-icon">{statIcon("dollar")}</div>
          <div className="mat-stat-text">
            <div className="mat-stat-money">{loading ? "" : rupeesShort(stats.inventoryValue)}</div>
            <div className="mat-stat-label">Inventory Value (at cost)</div>
            {!loading && (
              <div className="mat-stat-exact">{rupeesPK(stats.inventoryValue)} <span className="mat-stat-words">({amountInWords(stats.inventoryValue)})</span></div>
            )}
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="mat-toolbar">
        <div className="mat-search">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          <input type="text" placeholder="Search by material name or category..." value={search} onChange={(e) => setSearch(e.target.value)} autoComplete="off" name="mat-search-box" />
        </div>
        <select className="mat-category-filter" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="All">All Categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        {canAdd && (
          <button className="mat-add-btn" onClick={() => setFormModal({ mode: "add" })}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            Add Material
          </button>
        )}
      </div>

      {error && <div className="mat-error">{error}</div>}

      {/* Cards grid */}
      {loading ? (
        <div className="mat-empty"><div className="mat-spinner" /><p>Loading materials...</p></div>
      ) : filtered.length === 0 ? (
        <div className="mat-empty">
          <div className="mat-empty-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></svg>
          </div>
          <h3>{materials.length === 0 ? "No materials yet" : "No materials match your filters"}</h3>
          <p>{materials.length === 0 ? "Add your first material to get started." : "Try adjusting your search or filters."}</p>
        </div>
      ) : (
        <div className="mat-grid">
          {filtered.map((m) => {
            const low = isLow(m);
            const out = isOut(m);
            return (
              <div key={m.materialID} className={`mat-card ${out ? "out" : low ? "low" : ""}`}>
                {(low || out) && (
                  <div className={`mat-card-flag ${out ? "out" : "low"}`}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                    {out ? "Out of Stock" : "Low Stock"}
                  </div>
                )}

                <div className="mat-card-top">
                  <h4 className="mat-card-name">{m.name}</h4>
                  <span className="mat-card-unit">{m.unit}</span>
                </div>

                <div className="mat-card-stock">
                  <div className="mat-card-stock-num">{formatQty(m.currentStock)}</div>
                  <div className="mat-card-stock-label">{m.unit} in stock</div>
                </div>

                <div className="mat-card-info">
                  <div className="mat-card-info-row"><span>Avg Cost</span><strong className="accent">{rupees(m.avgCost)} / {m.unit}</strong></div>
                  <div className="mat-card-info-row"><span>Stock Value</span><strong>{rupees(m.stockValue)}</strong></div>
                  <div className="mat-card-info-row"><span>Min Alert</span><strong>{formatQty(m.lowStockThreshold)} {m.unit}</strong></div>
                </div>

                {canManage && (
                  <div className="mat-card-actions">
                    <button className="mat-btn-issue" onClick={() => setStockModal({ mode: "issue", material: m })}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /></svg>
                      Issue
                    </button>
                    <button className="mat-btn-restock" onClick={() => setStockModal({ mode: "restock", material: m })}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                      Restock
                    </button>
                  </div>
                )}

                <div className="mat-card-footer">
                  <button className="mat-foot-btn" onClick={() => navigate(`/dashboard/materials/${m.materialID}/history`)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                    History
                  </button>
                  {canEdit && (
                    <button className="mat-foot-btn" onClick={() => setFormModal({ mode: "edit", data: m })}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                      Edit
                    </button>
                  )}
                  {canDelete && (
                    <button className="mat-foot-btn mat-foot-delete" onClick={() => setConfirmDelete(m)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                      Delete
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit modal */}
      {formModal && (
        <MaterialFormModal
          mode={formModal.mode}
          initialData={formModal.data}
          existingCategories={categories}
          existingUnits={units}
          onClose={() => setFormModal(null)}
          onSave={handleSave}
        />
      )}

      {/* Restock / Issue modal */}
      {stockModal && (
        <StockModal
          mode={stockModal.mode}
          material={stockModal.material}
          projects={projects}
          onClose={() => setStockModal(null)}
          onSave={handleStock}
        />
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="mat-overlay" onClick={(e) => e.target.classList.contains("mat-overlay") && setConfirmDelete(null)}>
          <div className="mat-confirm">
            <div className="mat-confirm-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
            </div>
            <h3>Delete this material?</h3>
            <p><strong>{confirmDelete.name}</strong> and its full transaction history will be permanently deleted. This cannot be undone.</p>
            <div className="mat-confirm-actions">
              <button className="mat-confirm-cancel" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button className="mat-confirm-delete" onClick={() => handleDelete(confirmDelete.materialID)}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && <div className={`mat-toast mat-toast-${toast.type}`}>{toast.text}</div>}
    </DashboardLayout>
  );
}

export default Materials;
