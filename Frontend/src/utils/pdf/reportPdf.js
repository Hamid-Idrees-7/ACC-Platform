// Reports pdf: the open report tab (Financial, Projects, Materials or Workforce) with its
// figures, the charts as they are drawn on screen (kept as vector graphics) and its tables.

import { formatDateTime } from "../dates";
import { C, baseDocument, letterhead, titledTable, downloadPdf, pdfReadyCompany } from "./pdfEngine";

const TONE = { blue: C.blue, primary: C.primary, green: C.greenStrong, amber: C.amber, red: C.red };
const KEEP_FILLS = new Set(["#F66435", "#2E90FA", "#12B76A", "#7C4DDB", "#F79009", "#DC2626", "#0EA5E9", "#64748B", "#FFFFFF", "#FFF", "NONE"]);

// A Recharts chart on screen as clean SVG text for the PDF: light paper colours for the
// text and grid (the screen may be in dark mode), and no hover leftovers.
function chartSvg(svgEl) {
  const w = Math.round(svgEl.width?.baseVal?.value || svgEl.getBoundingClientRect().width);
  const h = Math.round(svgEl.height?.baseVal?.value || svgEl.getBoundingClientRect().height);
  if (!w || !h) return null;
  const svg = svgEl.cloneNode(true);
  svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  svg.setAttribute("width", w);
  svg.setAttribute("height", h);
  if (!svg.getAttribute("viewBox")) svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  svg.removeAttribute("style");
  svg.querySelectorAll(".recharts-tooltip-cursor, .recharts-active-dot").forEach((n) => n.remove());
  svg.querySelectorAll("text, tspan").forEach((t) => {
    const fill = (t.getAttribute("fill") || "").toUpperCase();
    if (!KEEP_FILLS.has(fill)) t.setAttribute("fill", "#475467");
    t.setAttribute("font-family", "Roboto");
  });
  svg.querySelectorAll(".recharts-cartesian-grid line, .recharts-cartesian-grid-horizontal line, .recharts-cartesian-grid-vertical line")
    .forEach((l) => l.setAttribute("stroke", "#E4E7EC"));
  svg.querySelectorAll(".recharts-cartesian-axis-line, .recharts-cartesian-axis-tick-line")
    .forEach((l) => l.setAttribute("stroke", "#98A2B3"));
  return { svg: new XMLSerializer().serializeToString(svg), w, h };
}

// Charts draw themselves in with an animation; pie labels appear only at the end.
// Waits (up to a few seconds) until every pie on the tab has its labels.
export async function waitForCharts(root, maxMs = 5000) {
  const start = Date.now();
  const ready = () => [...(root?.querySelectorAll(".rep-chart-card") || [])].every((card) =>
    !card.querySelector(".recharts-pie") || card.querySelector(".recharts-pie-labels, .recharts-pie-label-text"));
  while (!ready() && Date.now() - start < maxMs) {
    await new Promise((r) => setTimeout(r, 100));
  }
}

// Reads the chart cards of the open report tab.
export function captureCharts(root) {
  if (!root) return [];
  return [...root.querySelectorAll(".rep-chart-card")].map((card) => {
    // The chart itself (legend icons are small svgs of the same class, so pick the main one)
    const svgEl = card.querySelector(".recharts-wrapper > svg.recharts-surface");
    const legend = [...card.querySelectorAll(".recharts-legend-item")].map((item) => {
      const shape = item.querySelector("svg path, svg line, svg rect");
      const color = shape?.getAttribute("fill") && shape.getAttribute("fill") !== "none" ? shape.getAttribute("fill") : shape?.getAttribute("stroke");
      return { label: item.textContent.trim(), color: color || C.muted };
    });
    return {
      title: card.querySelector(".rep-chart-title")?.textContent.trim() || "",
      wide: card.classList.contains("wide"),
      chart: svgEl ? chartSvg(svgEl) : null,
      empty: card.querySelector(".rep-nochart")?.textContent.trim() || "",
      legend,
      note: card.querySelector(".rep-chart-note")?.textContent.trim() || "",
    };
  });
}

const kpiCell = (k) => ({
  stack: [
    { text: k.label.toUpperCase(), style: "label", margin: [0, 0, 0, 4] },
    { text: String(k.value), fontSize: 14, bold: true, color: TONE[k.tone] || C.text },
    k.words ? { text: k.words, fontSize: 7, color: C.muted, margin: [0, 2, 0, 0] } : null,
    k.sub ? { text: k.sub, fontSize: 7.5, color: C.muted, margin: [0, 3, 0, 0] } : null,
  ].filter(Boolean),
});

function kpiGrid(kpis) {
  const rows = [];
  for (let i = 0; i < kpis.length; i += 4) {
    const row = kpis.slice(i, i + 4).map(kpiCell);
    while (row.length < 4) row.push({ text: "" });
    rows.push(row);
  }
  return {
    table: { widths: ["*", "*", "*", "*"], body: rows },
    layout: {
      hLineWidth: () => 4,
      vLineWidth: () => 4,
      hLineColor: () => "#FFFFFF",
      vLineColor: () => "#FFFFFF",
      fillColor: (row, node, col) => (node.table.body[row][col].stack ? C.bg : null),
      paddingLeft: () => 9,
      paddingRight: () => 9,
      paddingTop: () => 8,
      paddingBottom: () => 8,
    },
    margin: [-4, 0, -4, 8],
  };
}

function chartBlock(c, width, fullWidth) {
  const parts = [{ text: c.title, bold: true, fontSize: 10, margin: [0, 0, 0, 6] }];
  if (c.chart) {
    // Keep the screen proportions, but never taller than about a third of the page
    const height = Math.min(fullWidth > 600 ? 200 : 260, Math.round((c.chart.h / c.chart.w) * width));
    parts.push({ svg: c.chart.svg, width, height });
  } else {
    parts.push({ text: c.empty || "No data yet", color: C.muted, italics: true, margin: [0, 10, 0, 10] });
  }
  if (c.legend.length) {
    parts.push({
      margin: [0, 6, 0, 0],
      columnGap: 14,
      columns: c.legend.map((l) => ({
        width: "auto",
        columns: [
          { width: 12, canvas: [{ type: "rect", x: 0, y: 2, w: 8, h: 8, r: 1.5, color: l.color }] },
          { width: "auto", text: l.label, color: C.muted, fontSize: 8.5 },
        ],
      })),
    });
  }
  if (c.note) parts.push({ text: c.note, style: "small", margin: [0, 4, 0, 0] });
  return { stack: parts, unbreakable: true, margin: [0, 10, 0, 6] };
}

// Wide charts use the full width; the others sit two to a row.
function chartSection(charts, contentWidth) {
  const half = Math.floor((contentWidth - 15) / 2);
  const out = [];
  let pending = null;
  const pair = (a, b) => ({ columns: [chartBlock(a, half, contentWidth), b ? chartBlock(b, half, contentWidth) : { text: "" }], columnGap: 15 });
  charts.forEach((c) => {
    if (c.wide) {
      if (pending) { out.push(pair(pending)); pending = null; }
      out.push(chartBlock(c, contentWidth, contentWidth));
    } else if (pending) {
      out.push(pair(pending, c));
      pending = null;
    } else {
      pending = c;
    }
  });
  if (pending) out.push(pair(pending));
  return out;
}

function dataTable(t) {
  const align = t.align || [];
  return titledTable({
    title: t.title,
    widths: t.widths || t.headers.map(() => "auto"),
    headers: t.headers.map((h, i) => ({ text: h.toUpperCase(), style: "th", alignment: align[i] || "left" })),
    // Numbers (right-aligned columns) never wrap: "Rs." and the amount stay on one line.
    rows: t.rows.map((r) =>
      r.map((cell, i) => {
        const base = { alignment: align[i] || "left", noWrap: align[i] === "right" };
        return typeof cell === "object" && cell !== null ? { ...base, ...cell } : { ...base, text: String(cell ?? "") };
      })
    ),
    fontSize: 8,
  });
}

// spec: { title, company, generatedAt, kpis, charts, tables, landscape }
export function buildReportDoc(spec) {
  const contentWidth = spec.landscape ? 762 : 515;
  const content = [
    ...letterhead(spec.company, [
      { text: "REPORT", style: "docKind" },
      { text: spec.title, style: "docNumber", fontSize: 14, margin: [0, 2, 0, 4] },
      { text: `As of ${formatDateTime(spec.generatedAt || new Date())}`, style: "small", alignment: "right" },
    ], contentWidth),
    kpiGrid(spec.kpis || []),
    ...chartSection(spec.charts || [], contentWidth),
    ...(spec.tables || []).map(dataTable),
  ];
  return baseDocument({
    title: `${spec.title} - ${spec.company?.companyName || ""}`,
    company: spec.company,
    content,
    pageOrientation: spec.landscape ? "landscape" : "portrait",
  });
}

export async function downloadReportPdf(spec) {
  const company = await pdfReadyCompany(spec.company);
  const today = new Date();
  const stamp = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  await downloadPdf(buildReportDoc({ ...spec, company }), `${spec.title} - ${stamp}`);
}
