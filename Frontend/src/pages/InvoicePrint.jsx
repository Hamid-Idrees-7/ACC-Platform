import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import DashboardLayout from "../components/DashboardLayout";
import { billingService } from "../services/billingService";
import { money, formatQty, amountInWords } from "../utils/format";
import { formatDateShort, formatDateTime } from "../utils/dates";
import DocLetterhead from "../components/DocLetterhead";
import Toast, { useToast } from "../components/Toast";
import "./InvoicePrint.css";

const fmtDate = (d) => formatDateShort(d, "—");

function InvoicePrint() {
  const { invoiceId } = useParams();
  const navigate = useNavigate();
  const [inv, setInv] = useState(null);
  const [loading, setLoading] = useState(true);
  const [making, setMaking] = useState(false);
  const [toast, showToast] = useToast(3500);

  useEffect(() => {
    (async () => {
      try {
        setInv(await billingService.getInvoicePrint(invoiceId));
      } catch {
        setInv(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [invoiceId]);

  if (loading) {
    return <DashboardLayout title="Invoice"><div className="ivp-loading"><div className="ivp-spinner" /></div></DashboardLayout>;
  }
  if (!inv) {
    return (
      <DashboardLayout title="Invoice">
        <button className="ivp-back" onClick={() => navigate("/dashboard/billing")}>← Back to Billing</button>
        <div className="ivp-error">Invoice not found.</div>
      </DashboardLayout>
    );
  }

  // A real pdf file (sharp text, same layout as this page), made in the browser
  const downloadPdf = async () => {
    setMaking(true);
    try {
      const { downloadInvoicePdf } = await import("../utils/pdf/invoicePdf");
      await downloadInvoicePdf(inv);
      showToast(`${inv.invoiceNumber}.pdf downloaded.`);
    } catch (err) {
      console.error("PDF could not be created:", err);
      showToast("Could not create the PDF. Please try again.", "error");
    } finally {
      setMaking(false);
    }
  };

  const st = (inv.status || "Unpaid").toLowerCase();
  const company = inv.company || {};
  const hasBank = !!(company.bankName || company.bankAccountNumber || company.bankIBAN);

  return (
    <DashboardLayout title="Invoice">
      <div className="ivp-bar">
        <button className="ivp-back" onClick={() => navigate(-1)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          Back
        </button>
        <div className="ivp-actions">
          <button className="ivp-print ghost" onClick={() => window.print()}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>
            Print
          </button>
          <button className="ivp-print" onClick={downloadPdf} disabled={making}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
            {making ? "Preparing PDF..." : "Download PDF"}
          </button>
        </div>
      </div>

      {/* On phones the A4-style document scrolls sideways instead of squeezing */}
      <div className="ivp-doc-scroll">
        <div className="ivp-doc theme-paper" id="ivp-print-area">
          {/* Header */}
          <div className="ivp-head">
            <DocLetterhead company={company} />
            <div className="ivp-inv-meta">
              <span className="ivp-doc-kind">{company.strn ? "Sales Tax Invoice" : "Invoice"}</span>
              <div className="ivp-inv-no">{inv.invoiceNumber}</div>
              <span className={`ivp-status ${st}`}>{inv.status.toUpperCase()}</span>
            </div>
          </div>

          <div className="ivp-rule" />

          {/* Bill-to + dates */}
          <div className="ivp-parties">
            <div className="ivp-billto">
              <span className="ivp-lbl">BILL TO</span>
              <strong>{inv.clientName}</strong>
              {inv.clientPhone && <div>{inv.clientPhone}</div>}
              {inv.clientAddress && <div>{inv.clientAddress}</div>}
            </div>
            <div className="ivp-project">
              <span className="ivp-lbl">PROJECT</span>
              <strong>{inv.projectTitle}</strong>
              {inv.projectLocation && <div>{inv.projectLocation}</div>}
            </div>
            <div className="ivp-dates">
              <div><span className="ivp-lbl">ISSUE DATE</span><strong>{fmtDate(inv.issueDate)}</strong></div>
              <div><span className="ivp-lbl">DUE DATE</span><strong>{fmtDate(inv.dueDate)}</strong></div>
            </div>
          </div>

          {/* Line items */}
          <div className="ivp-table-wrap">
            <table className="ivp-table">
              <thead>
                <tr><th className="ivp-c-no">#</th><th>DESCRIPTION</th><th className="r">QTY</th><th className="r">RATE</th><th className="r">AMOUNT</th></tr>
              </thead>
              <tbody>
                {inv.items.map((it, i) => (
                  <tr key={it.itemID ?? i}>
                    <td className="ivp-c-no">{i + 1}</td>
                    <td>{it.description}</td>
                    <td className="r">{formatQty(it.quantity)}</td>
                    <td className="r">{money(it.rate)}</td>
                    <td className="r">{money(it.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="ivp-summary">
            <div className="ivp-words">
              <span className="ivp-lbl">AMOUNT IN WORDS</span>
              <p>{amountInWords(inv.total)}</p>
            </div>
            <div className="ivp-totals">
              <div className="ivp-t-row"><span>Subtotal</span><strong>{money(inv.subtotal)}</strong></div>
              {inv.taxAmount > 0 && <div className="ivp-t-row"><span>Tax</span><strong>{money(inv.taxAmount)}</strong></div>}
              <div className="ivp-t-row ivp-t-total"><span>Total</span><strong>{money(inv.total)}</strong></div>
              <div className="ivp-t-row"><span>Paid</span><strong>{money(inv.paid)}</strong></div>
              <div className="ivp-t-row ivp-t-due"><span>Balance Due</span><strong>{money(inv.remaining)}</strong></div>
            </div>
          </div>

          {/* Payments */}
          {inv.payments && inv.payments.length > 0 && (
            <div className="ivp-pay-history">
              <span className="ivp-lbl">PAYMENT HISTORY</span>
              <table className="ivp-pay-table">
                <thead><tr><th>DATE</th><th>METHOD</th><th>REFERENCE</th><th className="r">AMOUNT</th></tr></thead>
                <tbody>
                  {inv.payments.map((p) => (
                    <tr key={p.paymentID}>
                      <td>{fmtDate(p.paymentDate)}</td>
                      <td>{p.method}</td>
                      <td>{p.reference || "—"}</td>
                      <td className="r">{money(p.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {inv.notes && <div className="ivp-notes"><strong>Notes:</strong> {inv.notes}</div>}

          {/* Where to pay, and the company's standard terms (Settings > Company) */}
          {(hasBank || company.invoiceTerms) && (
            <div className="ivp-pay-info">
              {hasBank && (
                <div className="ivp-bank">
                  <span className="ivp-lbl">PAYMENT DETAILS</span>
                  {company.bankName && <div><span>Bank</span><strong>{company.bankName}</strong></div>}
                  {company.bankAccountTitle && <div><span>Account title</span><strong>{company.bankAccountTitle}</strong></div>}
                  {company.bankAccountNumber && <div><span>Account no.</span><strong>{company.bankAccountNumber}</strong></div>}
                  {company.bankIBAN && <div><span>IBAN</span><strong>{company.bankIBAN}</strong></div>}
                </div>
              )}
              {company.invoiceTerms && (
                <div className="ivp-terms">
                  <span className="ivp-lbl">TERMS</span>
                  <p>{company.invoiceTerms}</p>
                </div>
              )}
            </div>
          )}

          <div className="ivp-foot">
            <p>This is a system-generated invoice from {(company.companyName || "").replace(/\.$/, "")}.</p>
            <p className="ivp-gen">Generated on {formatDateTime(inv.generatedAt)}</p>
          </div>

          <div className="ivp-sign">
            <div>Authorised Signature</div>
            <div>Received By</div>
          </div>
        </div>
      </div>
      <Toast toast={toast} />
    </DashboardLayout>
  );
}

export default InvoicePrint;
