// Invoice PDF, built from the same data as the invoice page.

import { money, formatQty, amountInWords, formatPhone } from "../format";
import { formatDateShort } from "../dates";
import { C, baseDocument, letterhead, statusPill, tableLayout, titledTable, totalsTable, signatures, downloadPdf, pdfReadyCompany } from "./pdfEngine";

const STATUS_TONE = { paid: "green", partial: "primary", overdue: "red", unpaid: "grey" };
const d = (v) => formatDateShort(v, "—");
const capitalize = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : "");

// A labelled block (Bill to, Project, Dates)
const party = (label, lines) => ({
  stack: [
    { text: label, style: "label", margin: [0, 0, 0, 4] },
    ...lines.filter(Boolean).map((l, i) => (i === 0 ? { text: l, bold: true, fontSize: 11 } : { text: l, style: "small", margin: [0, 2, 0, 0] })),
  ],
});

export function buildInvoiceDoc(inv) {
  const company = inv.company || {};
  const status = (inv.status || "Unpaid").toLowerCase();
  const hasBank = !!(company.bankName || company.bankAccountNumber || company.bankIBAN);
  const kind = company.strn ? "SALES TAX INVOICE" : "INVOICE";

  const items = [
    [
      { text: "#", style: "th" },
      { text: "DESCRIPTION", style: "th" },
      { text: "QTY", style: "th", alignment: "right" },
      { text: "RATE", style: "th", alignment: "right" },
      { text: "AMOUNT", style: "th", alignment: "right" },
    ],
    ...(inv.items || []).map((it, i) => [
      { text: String(i + 1), color: C.muted },
      { text: it.description || "" },
      { text: formatQty(it.quantity), alignment: "right" },
      { text: money(it.rate), alignment: "right" },
      { text: money(it.amount), alignment: "right", bold: true },
    ]),
  ];

  const content = [
    ...letterhead(company, [
      { text: kind, style: "docKind" },
      { text: inv.invoiceNumber, style: "docNumber", margin: [0, 2, 0, 6] },
      { columns: [{ text: "", width: "*" }, { width: "auto", ...statusPill(inv.status || "Unpaid", STATUS_TONE[status]) }] },
    ]),

    {
      columns: [
        party("BILL TO", [inv.clientName, formatPhone(inv.clientPhone), inv.clientAddress]),
        party("PROJECT", [inv.projectTitle, inv.projectLocation]),
        {
          width: 120,
          stack: [
            { text: "ISSUE DATE", style: "label", margin: [0, 0, 0, 3] },
            { text: d(inv.issueDate), bold: true, margin: [0, 0, 0, 8] },
            { text: "DUE DATE", style: "label", margin: [0, 0, 0, 3] },
            { text: d(inv.dueDate), bold: true, color: status === "overdue" ? C.red : C.text },
          ],
        },
      ],
      columnGap: 18,
      margin: [0, 0, 0, 18],
    },

    { table: { headerRows: 1, widths: [18, "*", 40, 85, 90], body: items }, layout: tableLayout },

    {
      columns: [
        {
          width: "*",
          margin: [0, 14, 16, 0],
          stack: [
            { text: "AMOUNT IN WORDS", style: "label", margin: [0, 0, 0, 4] },
            { text: capitalize(amountInWords(inv.total)), bold: true, fontSize: 10 },
          ],
        },
        {
          width: 230,
          margin: [0, 10, 0, 0],
          ...totalsTable([
            ["Subtotal", money(inv.subtotal)],
            ...(inv.taxAmount > 0 ? [["Tax", money(inv.taxAmount)]] : []),
            ["Total", money(inv.total), { bold: true, size: 13, color: C.text, lineAbove: true }],
            ["Paid", money(inv.paid)],
            ["Balance Due", money(inv.remaining), { bold: true, color: inv.remaining > 0 ? C.red : C.greenStrong, lineAbove: true }],
          ]),
        },
      ],
      unbreakable: true,
    },
  ];

  if ((inv.payments || []).length > 0) {
    content.push(
      titledTable({
        title: "Payment history",
        widths: [80, 90, "*", 90],
        headers: [
          { text: "DATE", style: "th" },
          { text: "METHOD", style: "th" },
          { text: "REFERENCE", style: "th" },
          { text: "AMOUNT", style: "th", alignment: "right" },
        ],
        rows: inv.payments.map((p) => [d(p.paymentDate), p.method || "", p.reference || "—", { text: money(p.amount), alignment: "right" }]),
      })
    );
  }

  if (inv.notes) {
    content.push({
      table: { widths: ["*"], body: [[{ text: [{ text: "Notes: ", bold: true }, inv.notes], color: C.muted, margin: [8, 6, 8, 6] }]] },
      layout: { hLineWidth: () => 0, vLineWidth: () => 0, fillColor: () => C.bg },
      margin: [0, 14, 0, 0],
    });
  }

  if (hasBank || company.invoiceTerms) {
    const bankRows = [
      ["Bank", company.bankName],
      ["Account title", company.bankAccountTitle],
      ["Account no.", company.bankAccountNumber],
      ["IBAN", company.bankIBAN],
    ].filter(([, v]) => v);
    content.push({
      columns: [
        hasBank ? {
          width: "*",
          stack: [
            { text: "PAYMENT DETAILS", style: "label", margin: [0, 0, 0, 5] },
            {
              table: { widths: [70, "*"], body: bankRows.map(([k, v]) => [{ text: k, color: C.muted }, { text: v, bold: true }]) },
              layout: "noBorders",
            },
          ],
        } : { width: "*", text: "" },
        company.invoiceTerms ? {
          width: "*",
          stack: [
            { text: "TERMS", style: "label", margin: [0, 0, 0, 5] },
            { text: company.invoiceTerms, fontSize: 9 },
          ],
        } : { width: "*", text: "" },
      ],
      columnGap: 24,
      margin: [0, 18, 0, 0],
      unbreakable: true,
    });
  }

  content.push(signatures("Authorised Signature", "Received By"));

  return baseDocument({ title: `Invoice ${inv.invoiceNumber}`, company, content });
}

export async function downloadInvoicePdf(inv) {
  const company = await pdfReadyCompany(inv.company);
  const doc = buildInvoiceDoc({ ...inv, company });
  await downloadPdf(doc, `${inv.invoiceNumber} - ${inv.clientName || "Invoice"}`);
}
