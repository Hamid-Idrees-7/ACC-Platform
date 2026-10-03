// Payslip PDF, built from the same data as the payslip page.

import { money, formatCnic, formatPhone } from "../format";
import { C, baseDocument, letterhead, statusPill, tableLayout, totalsTable, signatures, downloadPdf, pdfReadyCompany } from "./pdfEngine";

const unit = (l) => (l.sourceType === "Daily" ? "/day" : l.sourceType === "Contract" ? " contract" : "/month");

export function buildPayslipDoc(slip) {
  const company = slip.company || {};
  const paid = (slip.status || "").toLowerCase() === "paid";
  // Something is still due: the last total shows what is left to pay.
  const due = Number(slip.totalDue) > 0;

  const info = (label, value, extra) => ({
    stack: [
      { text: label, style: "label", margin: [0, 0, 0, 3] },
      { text: value || "—", bold: true, fontSize: 10.5 },
      extra ? { text: extra, style: "small", margin: [0, 2, 0, 0] } : null,
    ].filter(Boolean),
  });

  const lines = [
    [
      { text: "PROJECT", style: "th" },
      { text: "TYPE", style: "th" },
      { text: "RATE", style: "th" },
      { text: "ATTENDANCE", style: "th" },
      { text: "EARNED", style: "th", alignment: "right" },
      { text: "PAID", style: "th", alignment: "right" },
    ],
    ...(slip.lines || []).map((l) => [
      {
        stack: [
          { text: l.sourceType === "Monthly" ? "Company Payroll" : l.projectName || "" },
          l.note ? { text: `Note: ${l.note}`, style: "small", italics: true, margin: [0, 2, 0, 0] } : null,
        ].filter(Boolean),
      },
      l.sourceType,
      { text: [money(l.rate), { text: unit(l), color: C.muted, fontSize: 8 }], noWrap: true },
      l.sourceType === "Daily" ? `${l.presentDays} present / ${l.absentDays} absent` : "—",
      { text: money(l.calculatedAmount), alignment: "right", noWrap: true },
      Number(l.paidAmount) > 0
        ? {
            stack: [
              { text: money(l.paidAmount), bold: true, alignment: "right", color: C.greenStrong, noWrap: true },
              Number(l.dueAmount) > 0 ? { text: "PART PAID", fontSize: 7, bold: true, color: C.amber, alignment: "right" } : null,
            ].filter(Boolean),
          }
        : { text: "Pending", color: C.amber, bold: true, alignment: "right" },
    ]),
  ];

  const content = [
    ...letterhead(company, [
      { text: "SALARY PAYSLIP", style: "docKind" },
      { text: "PAY PERIOD", style: "docKind", color: C.subtle, margin: [0, 6, 0, 0] },
      { text: slip.periodLabel, style: "docNumber", margin: [0, 1, 0, 0] },
    ]),

    {
      table: {
        widths: ["*", "*", "*", 90],
        body: [[
          info("EMPLOYEE", slip.employeeName, slip.designation),
          info("CNIC", formatCnic(slip.cnic)),
          info("PHONE", formatPhone(slip.phone)),
          { stack: [{ text: "STATUS", style: "label", margin: [0, 0, 0, 4] }, statusPill(slip.status || "Pending", paid ? "green" : "amber")] },
        ]],
      },
      layout: { hLineWidth: () => 0, vLineWidth: () => 0, fillColor: () => C.bg, paddingLeft: () => 12, paddingRight: () => 12, paddingTop: () => 10, paddingBottom: () => 10 },
      margin: [0, 0, 0, 18],
    },

    { table: { headerRows: 1, widths: ["*", 50, "auto", "auto", 72, 72], body: lines }, layout: tableLayout },

    {
      columns: [
        { width: "*", text: "" },
        {
          width: 240,
          margin: [0, 12, 0, 0],
          ...totalsTable([
            ["Total earned", money(slip.totalCalculated)],
            ["Paid", money(slip.totalPaid)],
            [due ? "Due now" : "Net paid", money(due ? slip.totalDue : slip.totalPaid), { bold: true, size: 13, color: C.primaryDark, lineAbove: true }],
          ], 240),
        },
      ],
      unbreakable: true,
    },

    signatures("Signature: Administration", "Signature: Employee"),
  ];

  return baseDocument({ title: `Payslip ${slip.employeeName} ${slip.periodLabel}`, company, content });
}

export async function downloadPayslipPdf(slip) {
  const company = await pdfReadyCompany(slip.company);
  await downloadPdf(buildPayslipDoc({ ...slip, company }), `Payslip - ${slip.employeeName} - ${slip.periodLabel}`);
}
