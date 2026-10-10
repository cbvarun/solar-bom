// The standalone build bundles pdfkit's dependencies and Buffer for the browser.
import PDFDocument from "pdfkit/js/pdfkit.standalone";
import { sectionLabel } from "@/lib/engine";
import { QUANTITY_STATUS_LABEL, VERIFICATION_LABEL } from "@/lib/format";
import { STANDARD_EXCLUSIONS, STANDARD_TERMS, type ExportPayload } from "./payload";

const GREEN = "#163527";
const MUTED = "#5b6660";
const LINE = "#d6dcd9";

// DejaVu has no ₹ glyph; print the ISO code instead.
const inr = (v: number | null | undefined) => (v == null ? "—" : `INR ${v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
const amt = (v: number | null | undefined) => (v == null ? "—" : v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const qty = (v: number | null | undefined) => (v == null ? "TBC" : v.toLocaleString("en-IN", { maximumFractionDigits: 3 }));

interface Col { header: string; width: number; align?: "left" | "right"; get: (row: number) => string }

const font = (name: string) =>
  fetch(`/fonts/${name}`).then((r) => {
    if (!r.ok) throw new Error(`Could not load font ${name}`);
    return r.arrayBuffer();
  });

/** Builds the PDF in the browser. Fonts are fetched from /public/fonts. */
export async function bomPdf(d: ExportPayload, opts: { quotationNumber?: string; validUntil?: string } = {}): Promise<Blob> {
  const [FONT, FONT_B] = await Promise.all([font("DejaVuSans.ttf"), font("DejaVuSans-Bold.ttf")]);
  const validUntil = opts.validUntil ? new Date(opts.validUntil) : undefined;
  const generatedAt = new Date(d.generatedAt);
  const priced = new Map(d.pricing.lines.map((l) => [l.id, l]));
  const doc = new PDFDocument({ font: FONT as unknown as string, size: "A4", margins: { top: 50, bottom: 50, left: 40, right: 40 }, bufferPages: true, info: { Title: `${d.project.reference} BOM`, Author: d.company.name } });
  doc.registerFont("R", FONT);
  doc.registerFont("B", FONT_B);
  const chunks: Uint8Array[] = [];
  doc.on("data", (c: Uint8Array) => chunks.push(c));
  const done = new Promise<Blob>((res) => doc.on("end", () => res(new Blob(chunks as BlobPart[], { type: "application/pdf" }))));

  const W = doc.page.width - 80;
  const left = 40;
  const ensure = (h: number) => {
    if (doc.y + h > doc.page.height - 60) doc.addPage();
  };
  const h1 = (t: string) => { ensure(40); doc.moveDown(0.6).font("B").fontSize(13).fillColor(GREEN).text(t, left, doc.y, { width: W }); doc.moveTo(left, doc.y + 2).lineTo(left + W, doc.y + 2).strokeColor(LINE).stroke(); doc.moveDown(0.5); };
  const para = (t: string, size = 9, color = "#1d2521") => doc.font("R").fontSize(size).fillColor(color).text(t, left, doc.y, { width: W });
  const kv = (pairs: [string, string][], colW = 170) => {
    doc.fontSize(9);
    for (const [k, v] of pairs) {
      ensure(14);
      const y = doc.y;
      doc.font("R").fillColor(MUTED).text(k, left, y, { width: colW });
      doc.font("R").fillColor("#1d2521").text(v, left + colW, y, { width: W - colW });
      doc.y = Math.max(doc.y, y + 12);
    }
  };
  const table = (cols: Col[], rows: number, opts2: { size?: number; groupLabel?: (r: number) => string | null } = {}) => {
    const size = opts2.size ?? 7.5;
    const drawHeader = () => {
      const y = doc.y;
      doc.rect(left, y, W, 16).fill(GREEN);
      let x = left;
      doc.font("B").fontSize(size).fillColor("#ffffff");
      for (const c of cols) { doc.text(c.header, x + 3, y + 4, { width: c.width - 6, align: c.align ?? "left", lineBreak: false }); x += c.width; }
      doc.y = y + 18;
    };
    drawHeader();
    let lastGroup: string | null = null;
    for (let r = 0; r < rows; r++) {
      const g = opts2.groupLabel?.(r) ?? null;
      doc.font("R").fontSize(size);
      const heights = cols.map((c) => doc.heightOfString(c.get(r), { width: c.width - 6 }));
      const h = Math.max(...heights) + 6;
      if (doc.y + h + (g && g !== lastGroup ? 16 : 0) > doc.page.height - 60) { doc.addPage(); drawHeader(); lastGroup = null; }
      if (g && g !== lastGroup) {
        doc.rect(left, doc.y, W, 14).fill("#f0f7f3");
        doc.font("B").fontSize(size).fillColor(GREEN).text(g, left + 3, doc.y + 3, { width: W - 6 });
        doc.y += 4;
        lastGroup = g;
      }
      const y = doc.y;
      let x = left;
      doc.font("R").fontSize(size).fillColor("#1d2521");
      for (const c of cols) { doc.text(c.get(r), x + 3, y + 3, { width: c.width - 6, align: c.align ?? "left" }); x += c.width; }
      doc.moveTo(left, y + h).lineTo(left + W, y + h).strokeColor(LINE).lineWidth(0.5).stroke();
      doc.y = y + h;
    }
    doc.x = left;
  };

  // ---------- Header ----------
  doc.rect(0, 0, doc.page.width, 70).fill(GREEN);
  doc.circle(doc.page.width - 60, 35, 14).fill("#f5c02c");
  doc.font("B").fontSize(15).fillColor("#ffffff").text(d.company.name, left, 18, { width: W - 60 });
  doc.font("R").fontSize(8).fillColor("#dcece2").text(`${d.company.address} · ${d.company.phone} · ${d.company.email} · ${d.company.gstin}`, left, 40, { width: W - 60 });
  doc.y = 90;
  doc.font("B").fontSize(16).fillColor("#1d2521").text(opts.quotationNumber ? "Preliminary Quotation & Bill of Materials" : "Preliminary Bill of Materials", left);
  doc.font("R").fontSize(9).fillColor(MUTED).text(`${d.project.reference} · BOM revision ${d.bom.currentRevision} (${d.bom.status.toLowerCase()}) · generated ${generatedAt.toLocaleDateString("en-IN")}`);
  doc.moveDown(0.5);
  doc.rect(left, doc.y, W, 34).fillAndStroke("#fffbea", "#f5c02c");
  doc.font("B").fontSize(8).fillColor("#8a630d").text("PRELIMINARY ESTIMATE — not a substitute for electrical, structural or BESCOM/utility approval. Quantities marked Estimated or To be confirmed must be verified by a design engineer.", left + 8, doc.y + 6, { width: W - 16 });
  doc.y += 14;

  h1("Customer and project");
  kv([
    ["Project", d.project.name], ["Reference", d.project.reference], ["Location", d.project.location ?? "To be confirmed"],
    ["Customer", [d.project.customerName, d.project.customerEmail, d.project.customerPhone].filter(Boolean).join(" · ") || "Not provided"],
    ...(opts.quotationNumber ? ([["Quotation no.", opts.quotationNumber], ["Valid until", validUntil?.toLocaleDateString("en-IN") ?? "—"]] as [string, string][]) : []),
  ]);

  h1("Design summary and assumptions");
  const s = d.calc?.summary;
  kv([
    ...d.design,
    ["Installed DC capacity", s?.installedDcW != null ? `${s.installedDcW / 1000} kWp (${s.moduleCount} × ${s.moduleWp} Wp${s.formulaModuleCount !== s.moduleCount ? `; formula gives ${s.formulaModuleCount}` : ""})` : "—"],
    ["Inverter", s?.selectedInverter ? `${s.selectedInverter} — ${s.inverterAcW! / 1000} kW AC, DC/AC ${s.dcAcRatio}` : "No compatible inverter selected"],
    ["String plan", s?.stringLayout ? `${s.stringLayout.modulesPerString.join(" + ")} modules; Voc at design min. temp. ${s.stringLayout.vocAtMinTempV} V` : "—"],
    ["Estimated annual generation", s?.annualGeneration ? `${s.annualGeneration.kwh.toLocaleString("en-IN")} kWh/yr — indicative, not guaranteed (${s.annualGeneration.basis})` : "Not estimated: requires an engineer-verified specific yield"],
  ]);
  doc.moveDown(0.4);
  const assumptions = d.calc?.assumptions ?? [];
  if (assumptions.length) table([
    { header: "Assumption", width: W * 0.38, get: (r) => assumptions[r].label },
    { header: "Value", width: W * 0.22, get: (r) => assumptions[r].value },
    { header: "Source", width: W * 0.40, get: (r) => assumptions[r].source },
  ], assumptions.length);
  if (d.calc?.checks.some((c) => c.severity === "error")) {
    doc.moveDown(0.4);
    para("Configuration issues: " + d.calc.checks.filter((c) => c.severity === "error").map((c) => c.message).join(" "), 8.5, "#b91c1c");
  }

  // ---------- BOM ----------
  doc.addPage();
  h1("Detailed bill of materials");
  para(`Amounts in INR. Prices ${d.bom.pricesIncludeGst ? "include" : "exclude"} GST. Subtotal = procurement quantity × unit price. "—" = not priced or GST rate not configured.`, 8, MUTED);
  doc.moveDown(0.3);
  const it = d.items;
  table([
    { header: "#", width: 18, get: (r) => String(r + 1) },
    { header: "Item code", width: 48, get: (r) => it[r].itemCode },
    { header: "Component / specification", width: 150, get: (r) => `${it[r].name}\n${it[r].specification ?? ""}${it[r].manufacturer ? `\n${it[r].manufacturer} ${it[r].model ?? ""}` : ""}` },
    { header: "Unit", width: 24, get: (r) => it[r].unit },
    { header: "Qty", width: 30, align: "right", get: (r) => qty(it[r].procurementQty) },
    { header: "Status", width: 46, get: (r) => QUANTITY_STATUS_LABEL[it[r].quantityStatus] },
    { header: "Unit price", width: 50, align: "right", get: (r) => amt(it[r].unitPrice) },
    { header: "Subtotal", width: 52, align: "right", get: (r) => amt(priced.get(it[r].id)?.subtotal) },
    { header: "GST", width: 45, align: "right", get: (r) => (it[r].gstRatePercent != null ? `${it[r].gstRatePercent}%\n${amt(priced.get(it[r].id)?.gst)}` : "not set") },
    { header: "Total", width: W - 463, align: "right", get: (r) => amt(priced.get(it[r].id)?.total) },
  ], it.length, { groupLabel: (r) => sectionLabel(it[r].section) });

  // ---------- Cost summary ----------
  h1("Cost summary");
  const p = d.pricing;
  kv([
    ["Equipment (excl. GST)", inr(p.equipmentSubtotal)], ["Engineering, installation and services (excl. GST)", inr(p.servicesSubtotal)],
    ...d.bom.costItems.map((c) => [`${c.label} (excl. GST)`, c.amount == null ? "Not priced" : inr(c.amount)] as [string, string]),
    ["Subtotal (excl. GST)", inr(p.subtotalExGst)], ["GST", inr(p.gstTotal)], ["Estimated total (incl. GST)", inr(p.grandTotal)],
  ], 260);
  if (!p.complete) { doc.moveDown(0.3); para(`Incomplete pricing: ${p.unpricedLines} line(s) without a unit price and ${p.untaxedLines} without a configured GST rate. The total covers priced lines only.`, 8.5, "#8a630d"); }

  // ---------- Technical specs of major equipment ----------
  const majors = d.majors;
  if (majors.length) {
    h1("Technical specifications — major equipment");
    for (const m of majors) {
      ensure(40);
      doc.font("B").fontSize(9).fillColor("#1d2521").text(`${m.name} (${m.sku})${m.illustrative ? " — illustrative template, not a manufacturer datasheet" : ""}`, left);
      const specs = m.specs;
      table([
        { header: "Parameter", width: W * 0.5, get: (r) => specs[r].label },
        { header: "Value", width: W * 0.25, get: (r) => specs[r].value },
        { header: "Source", width: W * 0.25, get: (r) => specs[r].provenance },
      ], specs.length, { size: 7 });
      doc.moveDown(0.4);
    }
  }

  // ---------- Compliance ----------
  h1("Compliance notes");
  para("Status recorded by engineering for this project. Selecting certified products does not by itself make the project compliant. BESCOM approval has not been obtained unless marked Verified below.", 8, MUTED);
  doc.moveDown(0.3);
  const cl = d.compliance;
  table([
    { header: "Area", width: W * 0.18, get: (r) => cl[r].area },
    { header: "Check", width: W * 0.42, get: (r) => cl[r].title + (cl[r].notes ? `\n${cl[r].notes}` : "") },
    { header: "Reference", width: W * 0.18, get: (r) => cl[r].standardCode ?? "—" },
    { header: "Status", width: W * 0.22, get: (r) => VERIFICATION_LABEL[cl[r].status] },
  ], cl.length);

  // ---------- Taxes, exclusions, validity, terms ----------
  h1("Taxes and exclusions");
  para(`GST is applied per line from its configured tax classification. Lines without a configured rate carry no GST in this estimate and are flagged. Prices ${d.bom.pricesIncludeGst ? "include" : "exclude"} GST.`);
  doc.moveDown(0.3);
  for (const e of STANDARD_EXCLUSIONS) { ensure(14); para(`•  ${e}`); }
  h1("Quotation validity");
  para(validUntil ? `This quotation is valid until ${validUntil.toLocaleDateString("en-IN")}, subject to supplier price confirmation.` : `Indicative prices are valid for ${d.validityDays} days from the date of generation, subject to supplier price confirmation.`);
  h1("Terms and conditions");
  STANDARD_TERMS.forEach((t, n) => { ensure(14); para(`${n + 1}. ${t}`); });

  // Footer with page numbers
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc.page.margins.bottom = 0;
    doc.font("R").fontSize(7).fillColor(MUTED).text(`${d.project.reference} · Preliminary — subject to engineering verification · Page ${i + 1} of ${range.count}`, left, doc.page.height - 35, { width: W, align: "center", lineBreak: false });
  }
  doc.end();
  return done;
}
