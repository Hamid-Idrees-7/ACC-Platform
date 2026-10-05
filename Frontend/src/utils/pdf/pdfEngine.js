// Shared PDF building blocks for invoices, payslips and reports.
// pdfmake is loaded only when the first PDF is made, so it never slows down page loads.
// Documents are drawn from data, not screenshots, so the text stays sharp and
// searchable, and the paper is always white.

import { formatDateTime } from "../dates";

// Colours on paper (same as the light theme)
export const C = {
  primary: "#F66435",
  primaryDark: "#D94E22",
  primarySoft: "#FEEDE6",
  text: "#1A1D21",
  muted: "#667085",
  subtle: "#98A2B3",
  border: "#E4E7EC",
  bg: "#F7F8FA",
  green: "#12B76A",
  greenStrong: "#067647",
  greenSoft: "#E7F8EF",
  red: "#DC2626",
  redSoft: "#FDECEC",
  amber: "#B54708",
  amberSoft: "#FEF4E6",
  blue: "#1C6FD6",
};

let enginePromise = null;

// Loads pdfmake and its Roboto font once.
const loadEngine = () => {
  if (!enginePromise) {
    enginePromise = Promise.all([
      import("pdfmake/build/pdfmake"),
      import("pdfmake/build/vfs_fonts"),
    ]).then(([pdfMakeModule, fontsModule]) => {
      const pdfMake = pdfMakeModule.default || pdfMakeModule;
      const vfs = fontsModule.default || fontsModule;
      pdfMake.addVirtualFileSystem(vfs);
      // Documents only use images passed in as data, never links on the internet.
      pdfMake.setUrlAccessPolicy(() => false);
      return pdfMake;
    }).catch((err) => {
      enginePromise = null;
      throw err;
    });
  }
  return enginePromise;
};

// A file name that is safe on Windows, macOS and phones.
export const safeFileName = (name) =>
  `${String(name).replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim().slice(0, 120) || "document"}.pdf`;

// Builds and downloads the PDF. Returns when the file has been handed to the browser.
export async function downloadPdf(docDefinition, fileName) {
  const pdfMake = await loadEngine();
  await pdfMake.createPdf(docDefinition).download(safeFileName(fileName));
}

// Builds the PDF and opens the print dialog for it, from a hidden frame on this page,
// so the printout is exactly the downloaded file. Returns false if printing was blocked.
export async function printPdf(docDefinition) {
  const pdfMake = await loadEngine();
  const blob = await pdfMake.createPdf(docDefinition).getBlob();
  const url = URL.createObjectURL(blob);
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  const done = new Promise((resolve) => {
    frame.onload = () => {
      // A short wait lets the browser's PDF viewer finish drawing the page
      setTimeout(() => {
        try {
          frame.contentWindow.focus();
          frame.contentWindow.print();
          resolve(true);
        } catch {
          resolve(false);
        }
      }, 300);
    };
  });
  frame.src = url;
  document.body.appendChild(frame);
  const ok = await done;
  // The dialog keeps its own copy, so the frame can go once the user is done with it
  setTimeout(() => { frame.remove(); URL.revokeObjectURL(url); }, 120000);
  return ok;
}

// Base document: A4, margins, font sizes and named styles shared by all PDFs.
export function baseDocument({ title, company, content, footerNote, pageOrientation = "portrait" }) {
  const name = (company?.companyName || "").replace(/\.$/, "");
  const generated = formatDateTime(new Date());
  return {
    pageSize: "A4",
    pageOrientation,
    pageMargins: [40, 40, 40, 56],
    info: { title, author: name, creator: `${name} (ACC Platform)`, subject: title },
    defaultStyle: { font: "Roboto", fontSize: 9.5, color: C.text, lineHeight: 1.2 },
    styles: {
      companyName: { fontSize: 16, bold: true, color: C.text },
      muted: { color: C.muted },
      small: { fontSize: 8, color: C.muted },
      label: { fontSize: 7.5, bold: true, color: C.muted, characterSpacing: 0.6 },
      docKind: { fontSize: 8, bold: true, color: C.muted, characterSpacing: 1, alignment: "right" },
      docNumber: { fontSize: 16, bold: true, color: C.primary, alignment: "right" },
      sectionTitle: { fontSize: 11, bold: true, color: C.text, margin: [0, 14, 0, 6] },
      th: { fontSize: 7.5, bold: true, color: C.muted, characterSpacing: 0.4 },
    },
    content,
    footer: (currentPage, pageCount) => ({
      margin: [40, 16, 40, 0],
      columns: [
        { text: footerNote || `System-generated document from ${name}. Generated on ${generated}.`, style: "small", width: "*" },
        { text: `Page ${currentPage} of ${pageCount}`, style: "small", alignment: "right", width: 80 },
      ],
    }),
  };
}

// PDF readers only take PNG and JPEG. A WebP logo is redrawn as PNG first.
export async function pdfReadyCompany(company) {
  const logo = company?.logo;
  if (!logo || !/^data:image\/webp;base64,/i.test(logo) || typeof document === "undefined") return company || {};
  try {
    const png = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext("2d").drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = reject;
      img.src = logo;
    });
    return { ...company, logo: png };
  } catch {
    return { ...company, logo: null };
  }
}

// Initials for the logo box when the company has no logo.
const initialsOf = (name) =>
  (name || "").split(/\s+/).filter((w) => /^[A-Za-z]/.test(w)).slice(0, 3).map((w) => w[0]).join("").toUpperCase() || "CO";

// Company logo, or an orange box with the initials.
export function logoBlock(company) {
  if (company?.logo && /^data:image\/(png|jpeg);base64,/i.test(company.logo)) {
    return { image: company.logo, fit: [120, 52], width: 120 };
  }
  // WebP is not supported by PDF readers: fall back to the initials.
  return {
    width: 52,
    stack: [
      { canvas: [{ type: "rect", x: 0, y: 0, w: 52, h: 52, r: 6, color: C.primary }] },
      { text: initialsOf(company?.companyName), color: "#FFFFFF", bold: true, fontSize: 15, alignment: "center", margin: [0, -34, 0, 0], width: 52 },
    ],
  };
}

// Letterhead: logo and company details on the left, the document kind and number on the right.
// width: the printable width of the page (515 on portrait A4, 762 on landscape).
export function letterhead(company, right, width = 515) {
  const c = company || {};
  const place = [c.address, c.city].filter(Boolean).join(", ");
  const contact = [c.phone, c.email, c.website].filter(Boolean).join("  ·  ");
  const tax = [c.ntn && `NTN: ${c.ntn}`, c.strn && `STRN: ${c.strn}`].filter(Boolean).join("     ");

  return [
    {
      columns: [
        logoBlock(c),
        {
          width: "*",
          margin: [12, 0, 0, 0],
          stack: [
            { text: c.companyName || "", style: "companyName" },
            c.tagline ? { text: c.tagline, style: "muted", margin: [0, 1, 0, 0] } : null,
            place ? { text: place, style: "small", margin: [0, 3, 0, 0] } : null,
            contact ? { text: contact, style: "small", margin: [0, 1, 0, 0] } : null,
            tax ? { text: tax, fontSize: 8, bold: true, margin: [0, 2, 0, 0] } : null,
          ].filter(Boolean),
        },
        { width: 170, stack: right },
      ],
    },
    { canvas: [{ type: "rect", x: 0, y: 0, w: width, h: 2.5, color: C.primary }], margin: [0, 14, 0, 16] },
  ];
}

// A coloured pill for statuses (Paid, Overdue, Pending...).
export function statusPill(label, tone) {
  const tones = {
    green: [C.greenSoft, C.greenStrong],
    red: [C.redSoft, C.red],
    amber: [C.amberSoft, C.amber],
    primary: [C.primarySoft, C.primaryDark],
    grey: [C.bg, C.muted],
  };
  const [bg, fg] = tones[tone] || tones.grey;
  return {
    table: { body: [[{ text: String(label).toUpperCase(), bold: true, fontSize: 7.5, color: fg, fillColor: bg, margin: [6, 2, 6, 2], characterSpacing: 0.5 }]] },
    layout: "noBorders",
  };
}

// Light table layout: header underline, thin row lines, soft header background.
export const tableLayout = {
  hLineWidth: (i, node) => (i === 0 || i === node.table.body.length ? 0 : i === 1 ? 1 : 0.5),
  vLineWidth: () => 0,
  hLineColor: (i) => (i === 1 ? C.border : "#EEF0F3"),
  fillColor: (row) => (row === 0 ? C.bg : null),
  paddingLeft: () => 6,
  paddingRight: () => 6,
  paddingTop: () => 5,
  paddingBottom: () => 5,
};

// A table with its section title built in as the first header row. The title and the column
// headings repeat on every page the table runs onto, and the title can never be left alone at the
// bottom of a page: it always moves with the headings and at least one row.
export function titledTable({ title, widths, headers, rows, fontSize }) {
  const cols = headers.length;
  const titleRow = [
    { text: title, style: "sectionTitle", margin: [-6, 8, 0, 0], colSpan: cols },
    ...Array.from({ length: cols - 1 }, () => ({})),
  ];
  return {
    table: { headerRows: 2, keepWithHeaderRows: 1, dontBreakRows: true, widths, body: [titleRow, headers, ...rows] },
    layout: {
      ...tableLayout,
      hLineWidth: (i, node) => (i <= 1 || i === node.table.body.length ? 0 : i === 2 ? 1 : 0.5),
      hLineColor: (i) => (i === 2 ? C.border : "#EEF0F3"),
      fillColor: (row) => (row === 1 ? C.bg : null),
    },
    ...(fontSize ? { fontSize } : {}),
  };
}

// Label/value rows for totals, right-aligned.
export function totalsTable(rows, width = 230) {
  return {
    width,
    table: {
      widths: ["*", "auto"],
      body: rows.map(([label, value, opts = {}]) => [
        { text: label, color: opts.color || C.muted, bold: !!opts.bold, fontSize: opts.size || 9.5, margin: [0, 3, 0, 3] },
        { text: value, color: opts.color || C.text, bold: true, fontSize: opts.size || 9.5, alignment: "right", margin: [0, 3, 0, 3] },
      ]),
    },
    layout: {
      // A line above the rows marked lineAbove (eg Total)
      hLineWidth: (i) => (i > 0 && i < rows.length && rows[i][2]?.lineAbove ? 0.8 : 0),
      vLineWidth: () => 0,
      hLineColor: () => C.border,
      paddingLeft: () => 0,
      paddingRight: () => 0,
    },
  };
}

// Two signature lines at the end of a document.
export function signatures(left, right) {
  const line = (label) => ({
    width: 180,
    stack: [
      { canvas: [{ type: "line", x1: 0, y1: 0, x2: 180, y2: 0, lineWidth: 0.8, lineColor: C.muted }] },
      { text: label, alignment: "center", margin: [0, 5, 0, 0], fontSize: 9 },
    ],
  });
  return { columns: [line(left), { width: "*", text: "" }, line(right)], margin: [0, 44, 0, 0], unbreakable: true };
}
