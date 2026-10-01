import "./DocLetterhead.css";
import { companyInitials } from "../config/companyConfig";

// Company letterhead for printed documents (invoice, payslip), from Settings > Company.
// Shows the logo (or the company initials), name, tagline, contact line and tax numbers.

function DocLetterhead({ company, subtitle }) {
  const c = company || {};
  const place = [c.address, c.city].filter(Boolean).join(", ");
  const contact = [c.phone, c.email, c.website].filter(Boolean);
  const tax = [c.ntn && `NTN: ${c.ntn}`, c.strn && `STRN: ${c.strn}`].filter(Boolean);

  return (
    <div className="dlh">
      <div className={`dlh-logo ${c.logo ? "has-img" : ""}`}>
        {c.logo ? <img src={c.logo} alt="" /> : <span>{companyInitials(c.companyName)}</span>}
      </div>
      <div className="dlh-text">
        <h2>{c.companyName}</h2>
        {(c.tagline || subtitle) && <span className="dlh-sub">{c.tagline || subtitle}</span>}
        {place && <div className="dlh-line">{place}</div>}
        {contact.length > 0 && <div className="dlh-line">{contact.join(" · ")}</div>}
        {tax.length > 0 && <div className="dlh-line dlh-tax">{tax.join("   ·   ")}</div>}
      </div>
    </div>
  );
}

export default DocLetterhead;
