import { useState, useEffect, useMemo, useRef } from "react";
import DashboardLayout from "../components/DashboardLayout";
import { reportsService } from "../services/reportsService";
import { money, moneyShort, formatNum, formatQty, amountInWords } from "../utils/format";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { formatDateShort } from "../utils/dates";
import { chartTheme } from "../utils/chartTheme";
import { usePreferences } from "../context/PreferencesContext";
import { useCompany } from "../context/CompanyContext";
import Toast, { useToast } from "../components/Toast";
import "./Reports.css";

const TABS = [
  { key: "financial", label: "Financial" },
  { key: "projects", label: "Projects" },
  { key: "materials", label: "Materials" },
  { key: "workforce", label: "Workforce" },
];

// Chart palette
const PIE = ["#F66435", "#2E90FA", "#12B76A", "#7C4DDB", "#F79009", "#DC2626", "#0EA5E9", "#64748B"];
const C_PRIMARY = "#F66435";
const C_GREEN = "#12B76A";
const C_BLUE = "#2E90FA";
const C_AMBER = "#F79009";

// KPI stat card
function Kpi({ label, value, sub, words, tone }) {
  return (
    <div className={`rep-kpi ${tone || ""}`}>
      <div className="rep-kpi-lbl">{label}</div>
      <div className="rep-kpi-val">{value}</div>
      {words && <div className="rep-kpi-words">{words}</div>}
      {sub && <div className="rep-kpi-sub">{sub}</div>}
    </div>
  );
}

function KpiRows({ rows }) {
  return rows.map((row, i) => (
    <div className="rep-kpis" key={i}>
      {row.map((k) => <Kpi key={k.label} {...k} />)}
    </div>
  ));
}

function ChartCard({ title, children, wide }) {
  return (
    <div className={`rep-chart-card ${wide ? "wide" : ""}`}>
      <div className="rep-chart-title">{title}</div>
      <div className="rep-chart-body">{children}</div>
    </div>
  );
}

// Recharts tooltip that formats money nicely
const moneyTip = (value) => moneyShort(value);

// The figure cards of each tab, in rows. Used by the page and by the PDF.
function kpiRows(tab, data) {
  const fin = data.financial;
  const mat = data.materials;
  const wf = data.workforce;
  if (tab === "financial") return [
    [
      { label: "Total Budget", value: moneyShort(fin.totalBudget), words: amountInWords(fin.totalBudget), sub: `${fin.liveProjects} live project${fin.liveProjects === 1 ? "" : "s"}${fin.cancelledProjects > 0 ? ` · ${fin.cancelledProjects} cancelled excluded` : ""}`, tone: "blue" },
      { label: "Total Cost", value: moneyShort(fin.totalCost), words: amountInWords(fin.totalCost), sub: `Material ${moneyShort(fin.materialCost)} · Labour ${moneyShort(fin.labourCost)} · Expenses ${moneyShort(fin.expenseCost || 0)}`, tone: "amber" },
      { label: "Total Profit", value: moneyShort(fin.totalProfit), words: amountInWords(fin.totalProfit), sub: `Margin ${fin.marginPercent}%`, tone: "green" },
      { label: "Received", value: moneyShort(fin.totalReceived), words: amountInWords(fin.totalReceived), sub: `Billed ${moneyShort(fin.totalBilled)}`, tone: "primary" },
    ],
    [
      { label: "Remaining", value: moneyShort(fin.outstanding), words: amountInWords(fin.outstanding), tone: fin.outstanding > 0 ? "red" : "" },
      { label: "Overdue", value: moneyShort(fin.overdue), words: amountInWords(fin.overdue), tone: fin.overdue > 0 ? "red" : "" },
      { label: "Active Projects", value: fin.activeProjects },
      { label: "Completed", value: fin.completedProjects },
    ],
  ];
  if (tab === "projects") return [[
    { label: "Projects", value: fin.projectCount, tone: "blue" },
    { label: "Active", value: fin.activeProjects, tone: "primary" },
    { label: "Completed", value: fin.completedProjects, tone: "green" },
    { label: "Total Profit", value: moneyShort(fin.totalProfit), words: amountInWords(fin.totalProfit), sub: `Margin ${fin.marginPercent}%`, tone: "green" },
  ]];
  if (tab === "materials") return [
    [
      { label: "Materials", value: mat.totalMaterials, tone: "blue" },
      { label: "Inventory Value", value: moneyShort(mat.inventoryValue), words: amountInWords(mat.inventoryValue), tone: "primary" },
      { label: "Total Purchased", value: moneyShort(mat.totalPurchased), words: amountInWords(mat.totalPurchased), tone: "green" },
      { label: "Issued to Projects", value: moneyShort(mat.totalIssued), words: amountInWords(mat.totalIssued), tone: "amber" },
    ],
    [
      { label: "Low Stock", value: mat.lowStock, tone: mat.lowStock > 0 ? "amber" : "" },
      { label: "Out of Stock", value: mat.outOfStock, tone: mat.outOfStock > 0 ? "red" : "" },
    ],
  ];
  return [[
    { label: "Employees", value: wf.totalEmployees, sub: `${wf.activeEmployees} active`, tone: "blue" },
    { label: "Assignments", value: wf.totalAssignments, sub: `${wf.activeAssignments} active`, tone: "primary" },
    { label: "Attendance Rate", value: `${wf.presentRate}%`, sub: `${formatNum(wf.presentCount)} present · ${formatNum(wf.absentCount)} absent`, tone: "green" },
    { label: `Payroll — ${wf.payrollPeriod}`, value: moneyShort(wf.payrollTotal), words: amountInWords(wf.payrollTotal), sub: `Paid ${moneyShort(wf.payrollPaid)} · Pending ${moneyShort(wf.payrollPending)}`, tone: "amber" },
  ]];
}

// The tables of each tab for the PDF (the page draws its own).
function pdfTables(tab, data) {
  if (tab === "projects") return [{
    title: "Projects",
    headers: ["Project", "Client", "Status", "Progress", "Budget", "Cost", "Profit", "Margin", "Received", "Remaining"],
    align: ["left", "left", "left", "right", "right", "right", "right", "right", "right", "right"],
    widths: ["*", 95, 55, "auto", "auto", "auto", "auto", "auto", "auto", "auto"],
    rows: data.projects.map((p) => {
      const cancelled = p.status === "Cancelled";
      const tone = p.profit >= 0 ? "#067647" : "#DC2626";
      return [
        p.title, p.clientName, p.status, `${p.progress}%`, money(p.budget), money(p.cost),
        cancelled ? "—" : { text: money(p.profit), color: tone },
        cancelled ? "—" : { text: `${p.marginPercent}%`, color: tone },
        money(p.received), money(p.outstanding),
      ];
    }),
  }];
  if (tab === "materials") return [{
    title: "Materials",
    headers: ["Material", "Category", "Stock", "Avg cost", "Inventory value", "Purchased", "Issued"],
    align: ["left", "left", "right", "right", "right", "right", "right"],
    widths: ["*", 64, "auto", "auto", "auto", "auto", "auto"],
    rows: data.materials.topMaterials.map((m) => [
      m.stockState !== "OK" ? { text: [m.name, { text: `  ${m.stockState}`, color: m.stockState === "Out" ? "#DC2626" : "#B54708", fontSize: 7, bold: true }] } : m.name,
      m.category, `${formatQty(m.stock)} ${m.unit}`, money(m.avgCost), money(m.inventoryValue), money(m.purchased), money(m.issued),
    ]),
  }];
  return [];
}

function Reports() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [tab, setTab] = useState("financial");
  const { resolvedTheme } = usePreferences();
  const { company } = useCompany();
  const chart = useMemo(() => chartTheme(resolvedTheme), [resolvedTheme]);
  const printAreaRef = useRef(null);
  // When the open tab appeared: the charts need their draw-in animation to finish before a PDF.
  const shownAt = useRef(Date.now());
  useEffect(() => { shownAt.current = Date.now(); }, [tab, loading]);
  const [making, setMaking] = useState(false);
  const [toast, showToast] = useToast(3500);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        setData(await reportsService.getReports());
        setError(false);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return <DashboardLayout title="Reports"><div className="rep-empty"><div className="rep-spinner" /><p>Building reports...</p></div></DashboardLayout>;
  }
  if (error || !data) {
    return <DashboardLayout title="Reports"><div className="rep-empty"><h3>Could not load reports</h3><p>Please make sure the backend is running and try again.</p></div></DashboardLayout>;
  }

  const fin = data.financial;
  const mat = data.materials;
  const wf = data.workforce;

  const genOn = formatDateShort(data.generatedAt);
  const tabLabel = TABS.find((t) => t.key === tab)?.label;

  // PDF of the open tab: its figures, its charts as drawn and its tables.
  const downloadPdf = async () => {
    setMaking(true);
    try {
      const { downloadReportPdf, captureCharts, waitForCharts } = await import("../utils/pdf/reportPdf");
      const wait = 2000 - (Date.now() - shownAt.current);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      await waitForCharts(printAreaRef.current);
      await downloadReportPdf({
        title: `${tabLabel} Report`,
        company,
        generatedAt: data.generatedAt,
        kpis: kpiRows(tab, data).flat(),
        charts: captureCharts(printAreaRef.current),
        tables: pdfTables(tab, data),
        // The projects table has ten columns: a wide page keeps it readable.
        landscape: tab === "projects",
      });
      showToast(`${tabLabel} report downloaded.`);
    } catch (err) {
      console.error("PDF could not be created:", err);
      showToast("Could not create the PDF. Please try again.", "error");
    } finally {
      setMaking(false);
    }
  };

  return (
    <DashboardLayout title="Reports">
      <div id="rep-print-area" ref={printAreaRef}>
        <div className="rep-topbar">
          <div className="rep-tabs">
            {TABS.map((t) => (
              <button key={t.key} className={`rep-tab ${tab === t.key ? "active" : ""}`} onClick={() => setTab(t.key)}>
                {t.label}
              </button>
            ))}
          </div>
          <div className="rep-actions">
            <button className="rep-print ghost" onClick={() => window.print()}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>
              Print
            </button>
            <button className="rep-print" onClick={downloadPdf} disabled={making}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
              {making ? "Preparing PDF..." : "Download PDF"}
            </button>
          </div>
        </div>

        <div className="rep-print-head">
          <h2>{company.companyName} — {tabLabel} Report</h2>
          <span>Generated on {genOn}</span>
        </div>

        {/* FINANCIAL */}
        {tab === "financial" && (
          <>
            <KpiRows rows={kpiRows(tab, data)} />

            <div className="rep-charts">
              <ChartCard title="Revenue Trend — last 6 months" wide>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={fin.revenueTrend} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} />
                    <XAxis dataKey="label" tick={{ fill: chart.text, fontSize: 12 }} />
                    <YAxis tickFormatter={moneyShort} tick={{ fill: chart.text, fontSize: 11 }} width={70} />
                    <Tooltip formatter={moneyTip} {...chart.tooltip} />
                    <Legend wrapperStyle={{ color: chart.text }} />
                    <Line type="monotone" dataKey="billed" name="Billed" stroke={C_BLUE} strokeWidth={2.5} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="received" name="Received" stroke={C_GREEN} strokeWidth={2.5} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Budget vs Cost vs Profit">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={[{ name: "Company", Budget: fin.totalBudget, Cost: fin.totalCost, Profit: fin.totalProfit }]} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} />
                    <XAxis dataKey="name" tick={{ fill: chart.text, fontSize: 12 }} />
                    <YAxis tickFormatter={moneyShort} tick={{ fill: chart.text, fontSize: 11 }} width={70} />
                    <Tooltip formatter={moneyTip} {...chart.tooltip} />
                    <Legend wrapperStyle={{ color: chart.text }} />
                    <Bar dataKey="Budget" fill={C_BLUE} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Cost" fill={C_AMBER} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Profit" fill={C_GREEN} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Projects by Status">
                {fin.projectStatus.length === 0 ? <div className="rep-nochart">No projects yet</div> : (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie data={fin.projectStatus} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={95} label={(e) => `${e.label} (${e.value})`}>
                        {fin.projectStatus.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}
                      </Pie>
                      <Tooltip {...chart.tooltip} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>

              <ChartCard title="Project Expenses by Category — company cost" wide>
                {(fin.expensesByCategory || []).length === 0 ? (
                  <div className="rep-nochart">No project expenses recorded yet</div>
                ) : (
                  <ResponsiveContainer width="100%" height={Math.max(160, fin.expensesByCategory.length * 44 + 40)}>
                    <BarChart data={fin.expensesByCategory} layout="vertical" margin={{ top: 4, right: 24, left: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} horizontal={false} />
                      <XAxis type="number" tickFormatter={moneyShort} tick={{ fill: chart.text, fontSize: 11 }} />
                      <YAxis type="category" dataKey="label" tick={{ fill: chart.text, fontSize: 12 }} width={190} />
                      <Tooltip formatter={moneyTip} {...chart.tooltip} />
                      <Bar dataKey="value" name="Cost" fill={C_AMBER} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
                {fin.recoverableTotal > 0 && (
                  <p className="rep-chart-note">
                    Also paid on clients' behalf (billed back, not a cost): {money(fin.recoverableTotal)}
                    {fin.recoverablePending > 0 ? ` · ${money(fin.recoverablePending)} still to bill` : " · all billed"}
                  </p>
                )}
              </ChartCard>
            </div>
          </>
        )}

        {/* PROJECTS */}
        {tab === "projects" && (
          <>
            <KpiRows rows={kpiRows(tab, data)} />

            <div className="rep-charts">
              <ChartCard title="Budget vs Cost by Project" wide>
                {data.projects.filter((p) => p.status !== "Cancelled").length === 0 ? <div className="rep-nochart">No live projects yet</div> : (
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={data.projects.filter((p) => p.status !== "Cancelled").slice(0, 8)} margin={{ top: 10, right: 20, left: 10, bottom: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} />
                      <XAxis dataKey="title" tick={{ fill: chart.text, fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={60} />
                      <YAxis tickFormatter={moneyShort} tick={{ fill: chart.text, fontSize: 11 }} width={70} />
                      <Tooltip formatter={moneyTip} {...chart.tooltip} />
                      <Legend wrapperStyle={{ color: chart.text }} />
                      <Bar dataKey="budget" name="Budget" fill={C_BLUE} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="cost" name="Cost" fill={C_AMBER} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="profit" name="Profit" fill={C_GREEN} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>
            </div>

            <div className="rep-table-wrap">
              <table className="rep-table">
                <thead>
                  <tr>
                    <th>Project</th><th>Client</th><th>Status</th><th className="r">Progress</th>
                    <th className="r">Budget</th><th className="r">Cost</th><th className="r">Profit</th>
                    <th className="r">Margin</th><th className="r">Received</th><th className="r">Remaining</th>
                  </tr>
                </thead>
                <tbody>
                  {data.projects.map((p) => (
                    <tr key={p.projectID}>
                      <td>{p.title}</td>
                      <td>{p.clientName}</td>
                      <td><span className={`rep-status ${p.status.replace(/\s/g, "").toLowerCase()}`}>{p.status}</span></td>
                      <td className="r">{p.progress}%</td>
                      <td className="r">{money(p.budget)}</td>
                      <td className="r">{money(p.cost)}</td>
                      {p.status === "Cancelled" ? (
                        <><td className="r">—</td><td className="r">—</td></>
                      ) : (
                        <>
                          <td className={`r ${p.profit >= 0 ? "pos" : "neg"}`}>{money(p.profit)}</td>
                          <td className={`r ${p.profit >= 0 ? "pos" : "neg"}`}>{p.marginPercent}%</td>
                        </>
                      )}
                      <td className="r">{money(p.received)}</td>
                      <td className="r">{money(p.outstanding)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* MATERIALS */}
        {tab === "materials" && (
          <>
            <KpiRows rows={kpiRows(tab, data)} />

            <div className="rep-charts">
              <ChartCard title="Inventory Value by Category">
                {mat.byCategory.length === 0 ? <div className="rep-nochart">No inventory yet</div> : (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={mat.byCategory} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={100} label={(e) => e.label}>
                        {mat.byCategory.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}
                      </Pie>
                      <Tooltip formatter={moneyTip} {...chart.tooltip} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>

              <ChartCard title="Top Materials by Inventory Value">
                {mat.topMaterials.length === 0 ? <div className="rep-nochart">No inventory yet</div> : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={mat.topMaterials} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} />
                      <XAxis type="number" tickFormatter={moneyShort} tick={{ fill: chart.text, fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" tick={{ fill: chart.text, fontSize: 11 }} width={110} />
                      <Tooltip formatter={moneyTip} {...chart.tooltip} />
                      <Bar dataKey="inventoryValue" name="Inventory Value" fill={C_PRIMARY} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>
            </div>

            <div className="rep-table-wrap">
              <table className="rep-table">
                <thead>
                  <tr><th>Material</th><th>Category</th><th className="r">Stock</th><th className="r">Avg Cost</th><th className="r">Inventory Value</th><th className="r">Purchased</th><th className="r">Issued</th></tr>
                </thead>
                <tbody>
                  {mat.topMaterials.map((m) => (
                    <tr key={m.materialID}>
                      <td>{m.name} {m.stockState !== "OK" && <span className={`rep-tag ${m.stockState.toLowerCase()}`}>{m.stockState}</span>}</td>
                      <td>{m.category}</td>
                      <td className="r">{formatQty(m.stock)} {m.unit}</td>
                      <td className="r">{money(m.avgCost)}</td>
                      <td className="r">{money(m.inventoryValue)}</td>
                      <td className="r">{money(m.purchased)}</td>
                      <td className="r">{money(m.issued)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* WORKFORCE */}
        {tab === "workforce" && (
          <>
            <KpiRows rows={kpiRows(tab, data)} />

            <div className="rep-charts">
              <ChartCard title="Employees by Designation">
                {wf.byDesignation.length === 0 ? <div className="rep-nochart">No employees yet</div> : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={wf.byDesignation} margin={{ top: 10, right: 20, left: 10, bottom: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} />
                      <XAxis dataKey="label" tick={{ fill: chart.text, fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={60} />
                      <YAxis allowDecimals={false} tick={{ fill: chart.text, fontSize: 11 }} />
                      <Tooltip {...chart.tooltip} />
                      <Bar dataKey="value" name="Employees" fill={C_BLUE} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>

              <ChartCard title="Labour Cost by Project">
                {wf.labourByProject.length === 0 ? <div className="rep-nochart">No labour cost yet</div> : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={wf.labourByProject} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} />
                      <XAxis type="number" tickFormatter={moneyShort} tick={{ fill: chart.text, fontSize: 11 }} />
                      <YAxis type="category" dataKey="label" tick={{ fill: chart.text, fontSize: 11 }} width={110} />
                      <Tooltip formatter={moneyTip} {...chart.tooltip} />
                      <Bar dataKey="value" name="Labour Cost" fill={C_AMBER} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>

              <ChartCard title="Attendance">
                {(wf.presentCount + wf.absentCount) === 0 ? <div className="rep-nochart">No attendance marked yet</div> : (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={[{ label: "Present", value: wf.presentCount }, { label: "Absent", value: wf.absentCount }]} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={100} label={(e) => `${e.label} (${e.value})`}>
                        <Cell fill={C_GREEN} />
                        <Cell fill="#DC2626" />
                      </Pie>
                      <Tooltip {...chart.tooltip} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>
            </div>
          </>
        )}
      </div>
      <Toast toast={toast} />
    </DashboardLayout>
  );
}

export default Reports;
