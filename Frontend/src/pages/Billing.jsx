import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../components/DashboardLayout";
import { billingService } from "../services/billingService";
import { rupees, rupeesShort, rupeesPK, amountInWords } from "../utils/format";
import "./Billing.css";

function Billing() {
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        setData(await billingService.getOverview());
        setError(false);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Top-line totals rolled up from the project cards.
  const totals = useMemo(() => {
    const projects = data?.projects || [];
    return {
      billed: projects.reduce((s, p) => s + (p.billed || 0), 0),
      received: projects.reduce((s, p) => s + (p.received || 0), 0),
      outstanding: projects.reduce((s, p) => s + (p.outstanding || 0), 0),
      overdue: data?.overdueAmount || 0,
      overdueCount: data?.overdueCount || 0,
    };
  }, [data]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const projects = data?.projects || [];
    if (!q) return projects;
    return projects.filter((p) =>
      `${p.title} ${p.clientName} ${p.location} ${p.projectType}`.toLowerCase().includes(q)
    );
  }, [data, search]);

  const openProject = (p) => navigate(`/dashboard/billing/project/${p.projectID}`);

  // A short status word for the whole project card.
  const projectStatus = (p) => {
    if (p.invoiceCount === 0) return "none";
    if (p.overdueCount > 0) return "overdue";
    if (p.outstanding <= 0) return "paid";
    return "partial";
  };

  return (
    <DashboardLayout title="Billing & Invoices">
      {loading ? (
        <div className="bil-empty"><div className="bil-spinner" /><p>Loading billing...</p></div>
      ) : error ? (
        <div className="bil-empty"><h3>Could not load billing</h3><p>Please check the backend is running and try again.</p></div>
      ) : (
        <>
          {/* Top stats */}
          <div className="bil-stats">
            <div className="bil-stat">
              <span className="bil-stat-ic blue">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
              </span>
              <div>
                <div className="bil-stat-val">{rupeesShort(totals.billed)}</div>
                <div className="bil-stat-lbl">Total Billed</div>
                <div className="bil-stat-exact">{rupeesPK(totals.billed)} <span className="bil-stat-words">({amountInWords(totals.billed)})</span></div>
              </div>
            </div>
            <div className="bil-stat">
              <span className="bil-stat-ic green">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              </span>
              <div>
                <div className="bil-stat-val">{rupeesShort(totals.received)}</div>
                <div className="bil-stat-lbl">Received</div>
                <div className="bil-stat-exact">{rupeesPK(totals.received)} <span className="bil-stat-words">({amountInWords(totals.received)})</span></div>
              </div>
            </div>
            <div className="bil-stat">
              <span className="bil-stat-ic amber">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
              </span>
              <div>
                <div className="bil-stat-val">{rupeesShort(totals.outstanding)}</div>
                <div className="bil-stat-lbl">Remaining</div>
                <div className="bil-stat-exact">{rupeesPK(totals.outstanding)} <span className="bil-stat-words">({amountInWords(totals.outstanding)})</span></div>
              </div>
            </div>
            <div className="bil-stat">
              <span className="bil-stat-ic red">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
              </span>
              <div>
                <div className="bil-stat-val">{rupeesShort(totals.overdue)}</div>
                <div className="bil-stat-lbl">Overdue{totals.overdueCount > 0 ? ` (${totals.overdueCount})` : ""}</div>
                <div className="bil-stat-exact">{rupeesPK(totals.overdue)} <span className="bil-stat-words">({amountInWords(totals.overdue)})</span></div>
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="bil-toolbar">
            <div className="bil-search">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
              <input type="text" placeholder="Search project, client or location..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="bil-count">{visible.length} project{visible.length === 1 ? "" : "s"}</div>
          </div>

          {visible.length === 0 ? (
            <div className="bil-empty"><h3>No projects found</h3><p>Create a project first, then bill your client here against its budget.</p></div>
          ) : (
            <div className="bil-grid">
              {visible.map((p) => {
                const st = projectStatus(p);
                const pct = p.budget > 0 ? Math.min(100, Math.round((p.billed / p.budget) * 100)) : 0;
                return (
                  <button key={p.projectID} className={`bil-card ${st}`} onClick={() => openProject(p)}>
                    <div className="bil-card-head">
                      <div className="bil-card-title">
                        <h3>{p.title}</h3>
                        <span className="bil-client">{p.clientName}</span>
                      </div>
                      {p.overdueCount > 0
                        ? <span className="bil-badge overdue">{p.overdueCount} OVERDUE</span>
                        : p.invoiceCount === 0
                          ? <span className="bil-badge unpaid">NO INVOICES</span>
                          : p.outstanding <= 0
                            ? <span className="bil-badge paid">CLEARED</span>
                            : <span className="bil-badge partial">{p.invoiceCount} INVOICE{p.invoiceCount === 1 ? "" : "S"}</span>}
                    </div>

                    <div className="bil-meta">
                      {p.location && (
                        <span className="bil-meta-item">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                          {p.location}
                        </span>
                      )}
                      {p.projectType && <span className="bil-meta-item">{p.projectType}</span>}
                    </div>

                    {/* Billed-of-budget progress */}
                    <div className="bil-progress">
                      <div className="bil-progress-top">
                        <span>Billed of Budget</span>
                        <span className="bil-progress-pct">{pct}%</span>
                      </div>
                      <div className="bil-bar"><span style={{ width: `${pct}%` }} className={pct >= 100 ? "full" : ""} /></div>
                      <div className="bil-progress-sub">
                        <span>{rupees(p.billed)}</span>
                        <span>of {rupees(p.budget)}</span>
                      </div>
                    </div>

                    <div className="bil-figs">
                      <div className="bil-fig">
                        <span className="bil-fig-lbl">Received</span>
                        <span className="bil-fig-val green">{rupees(p.received)}</span>
                      </div>
                      <div className="bil-fig">
                        <span className="bil-fig-lbl">Remaining</span>
                        <span className={`bil-fig-val ${p.outstanding > 0 ? "amber" : ""}`}>{rupees(p.outstanding)}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
    </DashboardLayout>
  );
}

export default Billing;
