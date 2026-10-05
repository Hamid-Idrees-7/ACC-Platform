import { useState } from "react";
import { useCompany } from "../context/CompanyContext";
import { companyInitials } from "../config/companyConfig";
import { footerLines, taxLines, printLetterhead, downloadLetterheadPdf } from "../utils/pdf/letterheadPdf";
import Toast, { useToast } from "./Toast";
import "./LetterheadSettings.css";

// Settings > Letterhead (Admin only): a blank A4 company letterhead to print or download.
// Everything on it comes from Settings > Company, so it changes when the company details do.
// The preview is drawn to the same measurements as the PDF.

function LetterheadSettings() {
  const { company } = useCompany();
  const [mark, setMark] = useState(true);
  const [busy, setBusy] = useState("");
  const [toast, showToast] = useToast(3500);

  const c = company || {};
  const tax = taxLines(c);
  const foot = footerLines(c);
  const name = (c.companyName || "Company").replace(/\.$/, "");

  const run = async (kind) => {
    if (busy) return;
    setBusy(kind);
    try {
      if (kind === "print") {
        const ok = await printLetterhead(c, { mark });
        if (!ok) showToast("The browser blocked printing. Download the PDF and print it from there.", "error");
      } else {
        await downloadLetterheadPdf(c, { mark });
        showToast(`${name} letterhead.pdf downloaded.`);
      }
    } catch (err) {
      console.error("Letterhead PDF could not be created:", err);
      showToast("Could not create the letterhead. Please try again.", "error");
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="lh">
      <div className="lh-bar">
        <label className="lh-mark-toggle">
          <button
            type="button"
            role="switch"
            aria-checked={mark}
            aria-label="Light logo in the middle"
            className={`lh-switch ${mark ? "on" : ""}`}
            onClick={() => setMark((v) => !v)}
          >
            <span className="lh-knob" />
          </button>
          <span>Light logo in the middle</span>
        </label>
        <div className="lh-actions">
          <button className="lh-btn ghost" onClick={() => run("print")} disabled={!!busy}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>
            {busy === "print" ? "Preparing..." : "Print"}
          </button>
          <button className="lh-btn" onClick={() => run("download")} disabled={!!busy}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
            {busy === "download" ? "Preparing PDF..." : "Download PDF"}
          </button>
        </div>
      </div>

      <div className="lh-stage">
        <div className="lh-sheet-box">
          <div className="lh-sheet theme-paper" aria-label={`${name} letterhead preview`}>
            <div className="lh-top">
              <div className="lh-head">
                <div className={`lh-logo ${c.logo ? "has-img" : ""}`}>
                  {c.logo ? <img src={c.logo} alt="" /> : <span>{companyInitials(c.companyName)}</span>}
                </div>
                <div className="lh-name">
                  <strong>{c.companyName}</strong>
                  {c.tagline && <span>{c.tagline}</span>}
                </div>
                {tax.length > 0 && (
                  <div className="lh-tax">{tax.map((t) => <span key={t}>{t}</span>)}</div>
                )}
              </div>
              <div className="lh-rule" />
            </div>

            {mark && (
              <div className="lh-watermark" aria-hidden="true">
                {c.logo ? <img src={c.logo} alt="" /> : <span>{companyInitials(c.companyName)}</span>}
              </div>
            )}

            <div className="lh-foot">
              <div className="lh-foot-rule" />
              {foot.map((t) => <span key={t}>{t}</span>)}
            </div>
          </div>
        </div>
      </div>

      <p className="lh-note">
        The logo, name, tagline, tax numbers, address and contact details come from <strong>Settings &gt; Company</strong>.
        Change them there and the letterhead follows.
      </p>

      <Toast toast={toast} />
    </div>
  );
}

export default LetterheadSettings;
