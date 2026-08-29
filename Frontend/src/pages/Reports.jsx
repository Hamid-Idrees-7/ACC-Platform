import { useState, useEffect } from "react";
import DashboardLayout from "../components/DashboardLayout";
import { reportsService } from "../services/reportsService";
import { rupees, rupeesShort, formatNum, formatQty, amountInWords } from "../utils/format";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
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

function ChartCard({ title, children, wide }) {
  return (
    <div className={`rep-chart-card ${wide ? "wide" : ""}`}>
      <div className="rep-chart-title">{title}</div>
      <div className="rep-chart-body">{children}</div>
    </div>
  );
}

// Recharts tooltip that formats money nicely
const moneyTip = (value) => rupeesShort(value);

function Reports() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [tab, setTab] = useState("financial");

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

  const genOn = (() => {
    const x = new Date(data.generatedAt);
    const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${x.getDate()} ${MON[x.getMonth()]} ${x.getFullYear()}`;
  })();

  return (
    <DashboardLayout title="Reports">
      <div id="rep-print-area">
        <div className="rep-topbar">
          <div className="rep-tabs">
            {TABS.map((t) => (
              <button key={t.key} className={`rep-tab ${tab === t.key ? "active" : ""}`} onClick={() => setTab(t.key)}>
                {t.label}
              </button>
            ))}
          </div>
          <button className="rep-print" onClick={() => window.print()}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>
            Print / PDF
          </button>
        </div>

        <div className="rep-print-head">
          <h2>Anonymous Construction &amp; Co. — {TABS.find((t) => t.key === tab)?.label} Report</h2>
          <span>Generated on {genOn}</span>
        </div>

        {/* FINANCIAL */}
        {tab === "financial" && (
          <>
            <div className="rep-kpis">
              <Kpi label="Total Budget" value={rupeesShort(fin.totalBudget)} words={amountInWords(fin.totalBudget)} sub={`${fin.liveProjects} live project${fin.liveProjects === 1 ? "" : "s"}${fin.cancelledProjects > 0 ? ` · ${fin.cancelledProjects} cancelled excluded` : ""}`} tone="blue" />
              <Kpi label="Total Cost" value={rupeesShort(fin.totalCost)} words={amountInWords(fin.totalCost)} sub={`Material ${rupeesShort(fin.materialCost)} · Labour ${rupeesShort(fin.labourCost)}`} tone="amber" />
              <Kpi label="Total Profit" value={rupeesShort(fin.totalProfit)} words={amountInWords(fin.totalProfit)} sub={`Margin ${fin.marginPercent}%`} tone="green" />
              <Kpi label="Received" value={rupeesShort(fin.totalReceived)} words={amountInWords(fin.totalReceived)} sub={`Billed ${rupeesShort(fin.totalBilled)}`} tone="primary" />
            </div>
            <div className="rep-kpis">
              <Kpi label="Remaining" value={rupeesShort(fin.outstanding)} words={amountInWords(fin.outstanding)} tone={fin.outstanding > 0 ? "red" : ""} />
              <Kpi label="Overdue" value={rupeesShort(fin.overdue)} words={amountInWords(fin.overdue)} tone={fin.overdue > 0 ? "red" : ""} />
              <Kpi label="Active Projects" value={fin.activeProjects} />
              <Kpi label="Completed" value={fin.completedProjects} />
            </div>

            <div className="rep-charts">
              <ChartCard title="Revenue Trend — last 6 months" wide>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={fin.revenueTrend} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E4E7EC" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis tickFormatter={rupeesShort} tick={{ fontSize: 11 }} width={70} />
                    <Tooltip formatter={moneyTip} />
                    <Legend />
                    <Line type="monotone" dataKey="billed" name="Billed" stroke={C_BLUE} strokeWidth={2.5} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="received" name="Received" stroke={C_GREEN} strokeWidth={2.5} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Budget vs Cost vs Profit">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={[{ name: "Company", Budget: fin.totalBudget, Cost: fin.totalCost, Profit: fin.totalProfit }]} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E4E7EC" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tickFormatter={rupeesShort} tick={{ fontSize: 11 }} width={70} />
                    <Tooltip formatter={moneyTip} />
                    <Legend />
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
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>
            </div>
          </>
        )}

        {/* PROJECTS */}
        {tab === "projects" && (
          <>
            <div className="rep-kpis">
              <Kpi label="Projects" value={fin.projectCount} tone="blue" />
              <Kpi label="Active" value={fin.activeProjects} tone="primary" />
              <Kpi label="Completed" value={fin.completedProjects} tone="green" />
              <Kpi label="Total Profit" value={rupeesShort(fin.totalProfit)} words={amountInWords(fin.totalProfit)} sub={`Margin ${fin.marginPercent}%`} tone="green" />
            </div>

            <div className="rep-charts">
              <ChartCard title="Budget vs Cost by Project" wide>
                {data.projects.filter((p) => p.status !== "Cancelled").length === 0 ? <div className="rep-nochart">No live projects yet</div> : (
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={data.projects.filter((p) => p.status !== "Cancelled").slice(0, 8)} margin={{ top: 10, right: 20, left: 10, bottom: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E4E7EC" />
                      <XAxis dataKey="title" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={60} />
                      <YAxis tickFormatter={rupeesShort} tick={{ fontSize: 11 }} width={70} />
                      <Tooltip formatter={moneyTip} />
                      <Legend />
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
                      <td className="r">{rupees(p.budget)}</td>
                      <td className="r">{rupees(p.cost)}</td>
                      {p.status === "Cancelled" ? (
                        <><td className="r">—</td><td className="r">—</td></>
                      ) : (
                        <>
                          <td className={`r ${p.profit >= 0 ? "pos" : "neg"}`}>{rupees(p.profit)}</td>
                          <td className={`r ${p.profit >= 0 ? "pos" : "neg"}`}>{p.marginPercent}%</td>
                        </>
                      )}
                      <td className="r">{rupees(p.received)}</td>
                      <td className="r">{rupees(p.outstanding)}</td>
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
            <div className="rep-kpis">
              <Kpi label="Materials" value={mat.totalMaterials} tone="blue" />
              <Kpi label="Inventory Value" value={rupeesShort(mat.inventoryValue)} words={amountInWords(mat.inventoryValue)} tone="primary" />
              <Kpi label="Total Purchased" value={rupeesShort(mat.totalPurchased)} words={amountInWords(mat.totalPurchased)} tone="green" />
              <Kpi label="Issued to Projects" value={rupeesShort(mat.totalIssued)} words={amountInWords(mat.totalIssued)} tone="amber" />
            </div>
            <div className="rep-kpis">
              <Kpi label="Low Stock" value={mat.lowStock} tone={mat.lowStock > 0 ? "amber" : ""} />
              <Kpi label="Out of Stock" value={mat.outOfStock} tone={mat.outOfStock > 0 ? "red" : ""} />
            </div>

            <div className="rep-charts">
              <ChartCard title="Inventory Value by Category">
                {mat.byCategory.length === 0 ? <div className="rep-nochart">No inventory yet</div> : (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={mat.byCategory} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={100} label={(e) => e.label}>
                        {mat.byCategory.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}
                      </Pie>
                      <Tooltip formatter={moneyTip} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>

              <ChartCard title="Top Materials by Inventory Value">
                {mat.topMaterials.length === 0 ? <div className="rep-nochart">No inventory yet</div> : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={mat.topMaterials} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E4E7EC" />
                      <XAxis type="number" tickFormatter={rupeesShort} tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={110} />
                      <Tooltip formatter={moneyTip} />
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
                      <td className="r">{rupees(m.avgCost)}</td>
                      <td className="r">{rupees(m.inventoryValue)}</td>
                      <td className="r">{rupees(m.purchased)}</td>
                      <td className="r">{rupees(m.issued)}</td>
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
            <div className="rep-kpis">
              <Kpi label="Employees" value={wf.totalEmployees} sub={`${wf.activeEmployees} active`} tone="blue" />
              <Kpi label="Assignments" value={wf.totalAssignments} sub={`${wf.activeAssignments} active`} tone="primary" />
              <Kpi label="Attendance Rate" value={`${wf.presentRate}%`} sub={`${formatNum(wf.presentCount)} present · ${formatNum(wf.absentCount)} absent`} tone="green" />
              <Kpi label={`Payroll — ${wf.payrollPeriod}`} value={rupeesShort(wf.payrollTotal)} words={amountInWords(wf.payrollTotal)} sub={`Paid ${rupeesShort(wf.payrollPaid)} · Pending ${rupeesShort(wf.payrollPending)}`} tone="amber" />
            </div>

            <div className="rep-charts">
              <ChartCard title="Employees by Designation">
                {wf.byDesignation.length === 0 ? <div className="rep-nochart">No employees yet</div> : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={wf.byDesignation} margin={{ top: 10, right: 20, left: 10, bottom: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E4E7EC" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={60} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="value" name="Employees" fill={C_BLUE} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>

              <ChartCard title="Labour Cost by Project">
                {wf.labourByProject.length === 0 ? <div className="rep-nochart">No labour cost yet</div> : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={wf.labourByProject} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E4E7EC" />
                      <XAxis type="number" tickFormatter={rupeesShort} tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={110} />
                      <Tooltip formatter={moneyTip} />
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
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

export default Reports;
