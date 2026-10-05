// Blank company letterhead (Settings > Letterhead), A4, from Settings > Company.
// Header: logo, name, tagline and tax numbers. Footer: address and contact details.
// Optionally a light copy of the logo in the middle of the page.

import { C, logoBlock, downloadPdf, printPdf, pdfReadyCompany } from "./pdfEngine";
import { companyInitials } from "../../config/companyConfig";

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const SIDE = 40;
const WIDTH = PAGE_W - SIDE * 2;
const MARK = 280;   // largest side of the middle logo

export const footerLines = (c) => {
  const place = [c.address, c.city].filter(Boolean).join(", ");
  const contact = [c.phone, c.email, c.website].filter(Boolean).join("   ·   ");
  return [place, contact].filter(Boolean);
};

export const taxLines = (c) => [c.ntn && `NTN: ${c.ntn}`, c.strn && `STRN: ${c.strn}`].filter(Boolean);

// The real size of an image, to centre it on the page
const imageSize = (src) => new Promise((resolve) => {
  const img = new Image();
  img.onload = () => resolve({ w: img.naturalWidth || 1, h: img.naturalHeight || 1 });
  img.onerror = () => resolve(null);
  img.src = src;
});

async function middleMark(c) {
  if (c.logo && /^data:image\/(png|jpeg);base64,/i.test(c.logo)) {
    const size = await imageSize(c.logo);
    if (size) {
      const scale = MARK / Math.max(size.w, size.h);
      const w = size.w * scale;
      const h = size.h * scale;
      return { image: c.logo, width: w, height: h, opacity: 0.07, absolutePosition: { x: (PAGE_W - w) / 2, y: (PAGE_H - h) / 2 } };
    }
  }
  // No usable logo: the initials, large and light
  return {
    text: companyInitials(c.companyName),
    fontSize: 150,
    bold: true,
    color: C.primary,
    opacity: 0.06,
    alignment: "center",
    absolutePosition: { x: 0, y: PAGE_H / 2 - 95 },
    width: PAGE_W,
  };
}

export async function buildLetterheadDoc(company, { mark = true } = {}) {
  const c = await pdfReadyCompany(company || {});
  const name = (c.companyName || "").replace(/\.$/, "");
  const tax = taxLines(c);
  const foot = footerLines(c);
  const middle = mark ? await middleMark(c) : null;

  return {
    pageSize: "A4",
    pageMargins: [SIDE, 130, SIDE, 80],
    info: { title: `${name} letterhead`, author: name, creator: `${name} (ACC Platform)`, subject: "Letterhead" },
    defaultStyle: { font: "Roboto", fontSize: 10, color: C.text, lineHeight: 1.2 },
    background: () => (middle ? [middle] : []),
    header: () => ({
      margin: [SIDE, 36, SIDE, 0],
      stack: [
        {
          columns: [
            logoBlock(c),
            {
              width: "*",
              margin: [12, 4, 0, 0],
              stack: [
                { text: c.companyName || "", fontSize: 18, bold: true },
                c.tagline ? { text: c.tagline, color: C.muted, fontSize: 9.5, margin: [0, 2, 0, 0] } : null,
              ].filter(Boolean),
            },
            tax.length
              ? { width: "auto", margin: [0, 6, 0, 0], stack: tax.map((t) => ({ text: t, fontSize: 8, bold: true, color: C.muted, alignment: "right", margin: [0, 0, 0, 2] })) }
              : { width: 0, text: "" },
          ],
        },
        { canvas: [{ type: "rect", x: 0, y: 0, w: WIDTH, h: 2.5, color: C.primary }], margin: [0, 14, 0, 0] },
      ],
    }),
    footer: () => ({
      margin: [SIDE, 18, SIDE, 0],
      stack: [
        { canvas: [{ type: "rect", x: 0, y: 0, w: WIDTH, h: 1, color: C.primary }] },
        ...foot.map((t, i) => ({ text: t, fontSize: 8, color: C.muted, alignment: "center", margin: [0, i === 0 ? 7 : 2, 0, 0] })),
      ],
    }),
    // The page is left blank for the letter
    content: [{ text: "" }],
  };
}

const fileName = (company) => `${(company?.companyName || "Company").replace(/\.$/, "")} letterhead`;

export async function downloadLetterheadPdf(company, options) {
  await downloadPdf(await buildLetterheadDoc(company, options), fileName(company));
}

export async function printLetterhead(company, options) {
  return printPdf(await buildLetterheadDoc(company, options));
}
