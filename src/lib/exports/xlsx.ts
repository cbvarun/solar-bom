import ExcelJS from "exceljs";
import { QUANTITY_STATUS_LABEL, VERIFICATION_LABEL, PROVENANCE_LABEL, AVAILABILITY_LABEL } from "@/lib/format";
import { sectionLabel } from "@/lib/engine";
import { STANDARD_EXCLUSIONS, STANDARD_TERMS, type ExportPayload } from "./payload";

const GREEN = "FF163527";
const LIGHT = "FFF0F7F3";
const INR = '"₹"#,##,##0.00';

function header(ws: ExcelJS.Worksheet, row: number) {
  const r = ws.getRow(row);
  r.font = { bold: true, color: { argb: "FFFFFFFF" } };
  r.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GREEN } };
  r.alignment = { vertical: "middle", wrapText: true };
  r.height = 30;
}

function title(ws: ExcelJS.Worksheet, text: string, sub: string) {
  ws.getCell("A1").value = text;
  ws.getCell("A1").font = { bold: true, size: 14, color: { argb: GREEN } };
  ws.getCell("A2").value = sub;
  ws.getCell("A2").font = { italic: true, size: 9, color: { argb: "FF5B6660" } };
}

/**
 * Real, editable XLSX. The BOM sheet uses live formulas so procurement can
 * change quantities, prices or GST rates in Excel and totals recalculate.
 */
export async function bomXlsx(d: ExportPayload): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  wb.creator = d.company.name;
  wb.created = new Date(d.generatedAt);
  const sub = `${d.project.reference} · ${d.project.name} · BOM revision ${d.bom.currentRevision} · generated ${d.generatedAt.slice(0, 10)} · PRELIMINARY — subject to engineering verification`;

  const sm = wb.addWorksheet("Summary");
  // ---- BOM ----
  const ws = wb.addWorksheet("BOM", { views: [{ state: "frozen", ySplit: 4, xSplit: 3 }], pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
  title(ws, "Bill of Materials", sub);
  ws.getCell("A3").value = d.bom.pricesIncludeGst ? "Unit prices INCLUDE GST" : "Unit prices EXCLUDE GST";
  ws.getCell("A3").font = { bold: true, color: { argb: "FF8A630D" } };
  const cols = [
    ["Line", 6], ["Section", 22], ["Item code", 16], ["Component", 36], ["Specification", 40], ["Manufacturer", 22], ["Model", 16], ["Unit", 7],
    ["Calculated qty", 11], ["Procurement qty", 12], ["Quantity status", 15], ["Unit price (₹)", 14], ["Subtotal excl. GST (₹)", 16], ["GST rate %", 9],
    ["GST (₹)", 13], ["Total (₹)", 15], ["Price source", 16], ["Availability", 13], ["Supplier", 20], ["Compliance status", 18], ["Compliance requirement", 36],
    ["Quantity basis / assumptions", 44], ["Technical notes", 30], ["Supplier remarks", 30],
  ] as const;
  ws.getRow(4).values = cols.map((c) => c[0]);
  cols.forEach((c, i) => (ws.getColumn(i + 1).width = c[1]));
  header(ws, 4);
  const incl = d.bom.pricesIncludeGst;
  let r = 5;
  const writeFormulas = (row: ExcelJS.Row) => {
    const sub = incl ? `IF(OR(J${r}="",L${r}=""),"",IF(N${r}="",J${r}*L${r},J${r}*L${r}/(1+N${r}/100)))` : `IF(OR(J${r}="",L${r}=""),"",J${r}*L${r})`;
    row.getCell(13).value = { formula: sub };
    row.getCell(15).value = { formula: `IF(OR(M${r}="",N${r}=""),"",M${r}*N${r}/100)` };
    row.getCell(16).value = { formula: `IF(M${r}="","",M${r}+IF(O${r}="",0,O${r}))` };
    for (const c of [12, 13, 15, 16]) row.getCell(c).numFmt = INR;
    for (const c of [10, 12, 14, 19, 24]) row.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFBEA" } };
    row.alignment = { vertical: "top", wrapText: true };
  };
  for (const [n, i] of d.items.entries()) {
    const row = ws.getRow(r);
    row.values = [
      n + 1, sectionLabel(i.section), i.itemCode, i.name, i.specification ?? "", i.manufacturer ?? "", i.model ?? "", i.unit,
      i.calculatedQty ?? "TBC", i.procurementQty ?? null, QUANTITY_STATUS_LABEL[i.quantityStatus], i.unitPrice ?? null, null, i.gstRatePercent ?? null, null, null,
      i.priceProvenance ? PROVENANCE_LABEL[i.priceProvenance] : "", AVAILABILITY_LABEL[i.availability], i.supplierName ?? "", VERIFICATION_LABEL[i.complianceStatus],
      i.complianceReq ?? "", i.quantityBasis ?? "", i.technicalNotes ?? "", i.supplierRemarks ?? "",
    ];
    writeFormulas(row);
    if (i.quantityStatus === "TO_BE_CONFIRMED") row.getCell(11).font = { color: { argb: "FFB91C1C" }, bold: true };
    if (i.quantityStatus === "ESTIMATED") row.getCell(11).font = { color: { argb: "FF8A630D" } };
    r++;
  }
  // Transport and other configured costs use the same formulas with quantity 1.
  for (const [k, c] of d.bom.costItems.entries()) {
    const row = ws.getRow(r);
    row.values = [d.items.length + k + 1, "Other project costs", "COST", c.label, c.notes ?? "", "", "", "lot", 1, 1, "Estimated",
      c.amount, null, c.gstRatePercent, null, null];
    writeFormulas(row);
    r++;
  }
  const last = r - 1;
  ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: last, column: cols.length } };
  r++;
  const totalRow = (label: string, formula: string, bold = false) => {
    ws.getCell(`L${r}`).value = label;
    ws.getCell(`L${r}`).font = { bold };
    ws.getCell(`P${r}`).value = { formula };
    ws.getCell(`P${r}`).numFmt = INR;
    ws.getCell(`P${r}`).font = { bold };
    r++;
  };
  totalRow("Subtotal excl. GST", `SUM(M5:M${last})`);
  totalRow("GST", `SUM(O5:O${last})`);
  totalRow("Estimated total incl. GST", `SUM(P5:P${last})`, true);
  ws.getCell(`L${r + 1}`).value = "Yellow cells are editable. Lines without a GST rate carry no GST in the totals — set the rate from the current notification.";
  ws.getCell(`L${r + 1}`).font = { italic: true, size: 9 };

  // ---- Products & quantities ----
  const pq = wb.addWorksheet("Products & quantities");
  title(pq, "Products and quantities", sub);
  pq.getRow(4).values = ["Item code", "Product", "Manufacturer", "Model", "Unit", "Procurement qty", "Quantity status"];
  header(pq, 4);
  [16, 40, 24, 18, 8, 14, 16].forEach((w, i) => (pq.getColumn(i + 1).width = w));
  d.items.forEach((i, n) => {
    pq.getRow(5 + n).values = [i.itemCode, i.name, i.manufacturer ?? "", i.model ?? "", i.unit, i.procurementQty ?? null, QUANTITY_STATUS_LABEL[i.quantityStatus]];
  });

  // ---- Supplier comparison ----
  const sc = wb.addWorksheet("Supplier comparison");
  title(sc, "Supplier comparison", "Quotations on record from the active price list. Blank supplier columns are for procurement to fill in.");
  const suppliers = [...new Set(d.priceEntries.map((e) => e.supplierName).filter(Boolean))] as string[];
  const supCols = suppliers.length ? suppliers : [];
  const blanks = ["Supplier 1", "Supplier 2", "Supplier 3"].slice(0, Math.max(0, 3 - supCols.length));
  const allSup = [...supCols, ...blanks];
  sc.getRow(4).values = ["Item code", "Component", "Unit", "Procurement qty", ...allSup.flatMap((s) => [`${s} — unit price (₹)`, `${s} — lead time (days)`]), "Lowest unit price (₹)", "Selected supplier", "Remarks"];
  header(sc, 4);
  sc.getColumn(1).width = 16; sc.getColumn(2).width = 40; sc.getColumn(3).width = 7; sc.getColumn(4).width = 12;
  allSup.forEach((_, k) => { sc.getColumn(5 + k * 2).width = 16; sc.getColumn(6 + k * 2).width = 12; });
  d.items.forEach((i, n) => {
    const rr = 5 + n;
    const vals: (string | number | null)[] = [i.itemCode, i.name, i.unit, i.procurementQty ?? null];
    for (const s of allSup) {
      const e = d.priceEntries.find((x) => x.productId === i.productId && x.supplierName === s);
      vals.push(e ? e.unitPrice : null, e?.leadTimeDays ?? null);
    }
    sc.getRow(rr).values = vals;
    const priceCols = allSup.map((_, k) => sc.getColumn(5 + k * 2).letter + rr);
    const minCol = 5 + allSup.length * 2;
    sc.getRow(rr).getCell(minCol).value = { formula: `IF(COUNT(${priceCols.join(",")})=0,"",MIN(${priceCols.join(",")}))` };
    sc.getRow(rr).getCell(minCol).numFmt = INR;
    allSup.forEach((_, k) => (sc.getRow(rr).getCell(5 + k * 2).numFmt = INR));
  });

  // ---- Technical compliance ----
  const tc = wb.addWorksheet("Technical compliance");
  title(tc, "Technical compliance", "Status is recorded by engineering. A certified product does not by itself make the project compliant.");
  tc.getRow(4).values = ["Area", "Check", "Reference", "Official source", "Status", "Notes", "Reviewed by", "Reviewed at"];
  header(tc, 4);
  [20, 44, 22, 34, 22, 40, 22, 14].forEach((w, i) => (tc.getColumn(i + 1).width = w));
  let tr = 5;
  for (const c of d.compliance) {
    tc.getRow(tr++).values = [c.area, c.title, c.standardCode ?? "", c.officialUrl ?? "", VERIFICATION_LABEL[c.status], c.notes ?? "", c.reviewedBy ?? "", c.reviewedAt?.slice(0, 10) ?? ""];
  }
  tr += 1;
  tc.getRow(tr++).values = ["BOM line requirements"];
  tc.getRow(tr - 1).font = { bold: true };
  tc.getRow(tr).values = ["Item code", "Component", "Compliance requirement", "", "Status"];
  header(tc, tr++);
  for (const i of d.items.filter((x) => x.complianceReq)) tc.getRow(tr++).values = [i.itemCode, i.name, i.complianceReq ?? "", "", VERIFICATION_LABEL[i.complianceStatus]];

  // ---- Assumptions & exclusions ----
  const ae = wb.addWorksheet("Assumptions & exclusions");
  title(ae, "Design assumptions, outstanding checks and exclusions", sub);
  ae.getColumn(1).width = 46; ae.getColumn(2).width = 36; ae.getColumn(3).width = 50;
  let ar = 4;
  ae.getRow(ar).values = ["Design input", "Value"]; header(ae, ar++);
  for (const [k, v] of d.design) ae.getRow(ar++).values = [k, v];
  ar++;
  ae.getRow(ar).values = ["Assumption", "Value", "Source"]; header(ae, ar++);
  for (const a of d.calc?.assumptions ?? []) ae.getRow(ar++).values = [a.label, a.value, a.source];
  ar++;
  ae.getRow(ar).values = ["Outstanding engineering checks"]; header(ae, ar++);
  for (const o of d.calc?.outstanding ?? []) ae.getRow(ar++).values = [o];
  ar++;
  ae.getRow(ar).values = ["Exclusions"]; header(ae, ar++);
  for (const e of STANDARD_EXCLUSIONS) ae.getRow(ar++).values = [e];
  ar++;
  ae.getRow(ar).values = ["Terms"]; header(ae, ar++);
  for (const t of STANDARD_TERMS) ae.getRow(ar++).values = [t];
  ae.eachRow((row) => (row.alignment = { wrapText: true, vertical: "top" }));

  // ---- Summary ----
  title(sm, `${d.project.name} — project summary`, sub);
  sm.getColumn(1).width = 34; sm.getColumn(2).width = 40;
  const s = d.calc?.summary;
  const rows: [string, string | number | null][] = [
    ["Project reference", d.project.reference], ["Location", d.project.location ?? "TBC"],
    ["Target DC capacity (kWp)", s?.targetDcW != null ? s.targetDcW / 1000 : "TBC"],
    ["Installed DC capacity (kWp)", s?.installedDcW != null ? s.installedDcW / 1000 : null],
    ["Module count", s?.moduleCount ?? null], ["Module count by formula", s?.formulaModuleCount ?? null],
    ["Inverter AC capacity (kW)", s?.inverterAcW != null ? s.inverterAcW / 1000 : null], ["DC/AC ratio", s?.dcAcRatio ?? null],
    ["Selected module", s?.selectedModule ?? ""], ["Selected inverter", s?.selectedInverter ?? ""], ["Selected structure", s?.selectedStructure ?? ""],
    ["Estimated annual generation (kWh)", s?.annualGeneration ? s.annualGeneration.kwh : "Not estimated (no verified specific yield)"],
    ["Subtotal excl. GST (₹, priced lines)", d.pricing.subtotalExGst], ["GST (₹)", d.pricing.gstTotal], ["Estimated total incl. GST (₹)", d.pricing.grandTotal],
    ["Lines without price", d.pricing.unpricedLines], ["Lines without GST rate", d.pricing.untaxedLines],
  ];
  rows.forEach(([k, v], n) => (sm.getRow(4 + n).values = [k, v]));

  return new Uint8Array(await wb.xlsx.writeBuffer());
}
