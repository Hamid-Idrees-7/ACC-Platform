import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import DashboardLayout from "../components/DashboardLayout";
import { salaryService } from "../services/salaryService";
import { rupees } from "../utils/format";
import { formatDateTime } from "../utils/dates";
import "./Payslip.css";

const rateLabel = (l) =>
  l.sourceType === "Monthly" ? `${rupees(l.rate)}` : l.sourceType === "Contract" ? `${rupees(l.rate)}` : `${rupees(l.rate)}`;
const rateUnit = (l) => (l.sourceType === "Daily" ? "/day" : l.sourceType === "Contract" ? "contract" : "/month");

function Payslip() {
  const { employeeId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const year = Number(params.get("year"));
  const month = Number(params.get("month"));

  const [slip, setSlip] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setSlip(await salaryService.getPayslip(employeeId, year, month));
      } catch {
        setSlip(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [employeeId, year, month]);

  if (loading) {
    return <DashboardLayout title="Salary Payslip"><div className="psl-loading"><div className="psl-spinner" /></div></DashboardLayout>;
  }
  if (!slip) {
    return (
      <DashboardLayout title="Salary Payslip">
        <button className="psl-back" onClick={() => navigate("/dashboard/salaries")}>← Back to Salaries</button>
        <div className="psl-error">Payslip not found.</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Salary Payslip">
      <div className="psl-bar">
        <button className="psl-back" onClick={() => navigate("/dashboard/salaries")}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          Back to Salaries
        </button>
        <button className="psl-print" onClick={() => window.print()}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>
          Print Payslip
        </button>
      </div>

      {/* On phones the A4-style document scrolls sideways instead of squeezing */}
      <div className="psl-doc-scroll">
        <div className="psl-doc theme-paper" id="psl-print-area">
          <div className="psl-head">
            <div className="psl-brand">
              <div className="psl-logo">ACC</div>
              <div>
                <h2>{slip.companyName}</h2>
                <span>Salary — Payslip Document</span>
              </div>
            </div>
            <div className="psl-period">
              <span>PAY PERIOD</span>
              <strong>{slip.periodLabel}</strong>
            </div>
          </div>

          <div className="psl-rule" />

          <div className="psl-emp">
            <div><span>EMPLOYEE</span><strong>{slip.employeeName}</strong><em>{slip.designation}</em></div>
            <div><span>CNIC</span><strong>{slip.cnic || "—"}</strong></div>
            <div><span>PHONE</span><strong>{slip.phone || "—"}</strong></div>
            <div><span>STATUS</span><strong className={`psl-status ${slip.status.toLowerCase()}`}>{slip.status.toUpperCase()}</strong></div>
          </div>

          <div className="psl-table-wrap">
            <table className="psl-table">
              <thead>
                <tr>
                  <th>PROJECT</th><th>TYPE</th><th>RATE</th><th>ATTENDANCE</th><th className="r">CALCULATED</th><th className="r">PAID</th>
                </tr>
              </thead>
              <tbody>
                {slip.lines.map((l, i) => (
                  <tr key={i}>
                    <td>{l.sourceType === "Monthly" ? "Company Payroll" : l.projectName}{l.note && <div className="psl-note">Note: {l.note}</div>}</td>
                    <td>{l.sourceType}</td>
                    <td>{rateLabel(l)} <span className="psl-unit">{rateUnit(l)}</span></td>
                    <td>{l.sourceType === "Daily" ? `${l.presentDays} present / ${l.absentDays} absent` : "—"}</td>
                    <td className="r">{rupees(l.calculatedAmount)}</td>
                    <td className="r">
                      {l.isPaid ? (
                        <div className="psl-paid">
                          <strong>{rupees(l.paidAmount)}</strong>
                          {Number(l.paidAmount) !== Number(l.calculatedAmount) && <span className="psl-override">OVERRIDE</span>}
                        </div>
                      ) : (
                        <span className="psl-pending">Pending</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="psl-totals">
            <div className="psl-total-row"><span>Total Calculated</span><strong>{rupees(slip.totalCalculated)}</strong></div>
            <div className="psl-net"><span>Net Payable / Paid</span><strong>{rupees(slip.netPaid)}</strong></div>
          </div>

          <div className="psl-foot">
            <p>This is a system-generated payslip from the ACC.</p>
            <p className="psl-gen">Generated on {formatDateTime(slip.generatedAt)}</p>
          </div>

          <div className="psl-sign">
            <div>Signature: Administration</div>
            <div>Signature: Employee</div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default Payslip;
