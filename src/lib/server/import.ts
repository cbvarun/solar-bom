import "server-only";
import Papa from "papaparse";
import ExcelJS from "exceljs";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { audit, type Actor } from "./audit";

/**
 * Bulk product import from CSV or XLSX (first sheet, header row 1).
 *
 * Fixed columns: sku, name, model, category (slug), manufacturer (exact name),
 * unit, plus optional tax_class (code), availability, lead_time_days,
 * warranty_text, warranty_source, ip_rating, material, dimensions, weight_kg,
 * description, provenance.
 * Specification columns are named `spec:<key>` or `spec:<key>[unit]`, e.g.
 * `spec:pmax_w[W]`. Imported specifications are recorded as ENGINEER_ENTERED
 * or lower: a value can only become MANUFACTURER_VERIFIED in the product
 * editor, where a source datasheet and verification date are required.
 */
export const IMPORT_COLUMNS = ["sku", "name", "model", "category", "manufacturer", "unit", "tax_class", "availability", "lead_time_days", "warranty_text", "warranty_source", "ip_rating", "material", "dimensions", "weight_kg", "description", "provenance"] as const;

const opt = z.preprocess((v) => (v === "" || v == null ? null : String(v).trim()), z.string().max(4000).nullable());
const optNum = z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number({ invalid_type_error: "must be a number" }).min(0).nullable());
const rowSchema = z.object({
  sku: z.string().trim().min(1, "sku is required").max(64).regex(/^[A-Za-z0-9._-]+$/, "sku may contain letters, digits, dot, dash, underscore"),
  name: z.string().trim().min(1, "name is required").max(300),
  model: z.string().trim().min(1, "model is required").max(120),
  category: z.string().trim().min(1, "category is required"),
  manufacturer: z.string().trim().min(1, "manufacturer is required"),
  unit: z.string().trim().min(1, "unit is required").max(20),
  tax_class: opt,
  availability: z.preprocess((v) => (v === "" || v == null ? "UNKNOWN" : String(v).trim().toUpperCase()), z.enum(["IN_STOCK", "LEAD_TIME", "ON_REQUEST", "DISCONTINUED", "UNKNOWN"])),
  lead_time_days: optNum,
  warranty_text: opt,
  warranty_source: z.preprocess((v) => (v === "" || v == null ? null : String(v).trim().toUpperCase()), z.enum(["SUPPLIER_QUOTED", "ENGINEER_ENTERED", "USER_ESTIMATE", "ILLUSTRATIVE"]).nullable()),
  ip_rating: opt, material: opt, dimensions: opt, weight_kg: optNum, description: opt,
  provenance: z.preprocess((v) => (v === "" || v == null ? "ENGINEER_ENTERED" : String(v).trim().toUpperCase()), z.enum(["SUPPLIER_QUOTED", "ENGINEER_ENTERED", "USER_ESTIMATE", "ILLUSTRATIVE"], { errorMap: () => ({ message: "provenance must be SUPPLIER_QUOTED, ENGINEER_ENTERED, USER_ESTIMATE or ILLUSTRATIVE (manufacturer verification is done per value in the editor)" }) })),
});

type Raw = Record<string, unknown>;
export type ImportResult = { summary: string; errors: { row: number; message: string }[]; created: number; updated: number };

async function parse(buf: Buffer, fileName: string): Promise<Raw[]> {
  if (/\.xlsx$/i.test(fileName)) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
    const ws = wb.worksheets[0];
    if (!ws) return [];
    const headers: string[] = [];
    ws.getRow(1).eachCell((c, col) => (headers[col] = String(c.text ?? "").trim()));
    const rows: Raw[] = [];
    ws.eachRow((r, i) => {
      if (i === 1) return;
      const o: Raw = {};
      headers.forEach((h, col) => { if (h) o[h] = r.getCell(col).text?.trim() ?? ""; });
      if (Object.values(o).some((v) => v !== "")) rows.push(o);
    });
    return rows;
  }
  if (/\.csv$/i.test(fileName)) {
    const text = buf.toString("utf8").replace(/^﻿/, "");
    const res = Papa.parse<Raw>(text, { header: true, skipEmptyLines: "greedy", transformHeader: (h) => h.trim() });
    return res.data;
  }
  throw new Error("Only .csv and .xlsx files are supported.");
}

const SPEC_RE = /^spec:([a-z0-9_]+)(?:\[(.+)\])?$/;
const humanize = (k: string) => k.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

/** Validate (and, when commit is true, write) a product file. Nothing is written if any row fails. */
export async function importProducts(buf: Buffer, fileName: string, commit: boolean, actor: Actor): Promise<ImportResult> {
  let rows: Raw[];
  try {
    rows = await parse(buf, fileName);
  } catch (e) {
    return { summary: e instanceof Error ? e.message : "Could not read the file.", errors: [{ row: 0, message: "Unreadable file" }], created: 0, updated: 0 };
  }
  if (!rows.length) return { summary: "The file has no data rows.", errors: [{ row: 0, message: "No rows" }], created: 0, updated: 0 };
  if (rows.length > 2000) return { summary: "Import at most 2,000 rows per file.", errors: [{ row: 0, message: "Too many rows" }], created: 0, updated: 0 };

  const headers = Object.keys(rows[0]);
  const unknown = headers.filter((h) => !(IMPORT_COLUMNS as readonly string[]).includes(h) && !SPEC_RE.test(h));
  const specCols = headers.flatMap((h) => { const m = SPEC_RE.exec(h); return m ? [{ header: h, key: m[1], unit: m[2] ?? null }] : []; });

  const [cats, mfrs, taxes, existing] = await Promise.all([
    prisma.productCategory.findMany(), prisma.manufacturer.findMany(), prisma.taxClass.findMany(),
    prisma.product.findMany({ select: { id: true, sku: true } }),
  ]);
  const catBy = new Map(cats.map((c) => [c.slug, c]));
  const mfrBy = new Map(mfrs.map((m) => [m.name.toLowerCase(), m]));
  const taxBy = new Map(taxes.map((t) => [t.code, t]));
  const skuBy = new Map(existing.map((p) => [p.sku, p.id]));

  const errors: ImportResult["errors"] = unknown.map((h) => ({ row: 1, message: `Unknown column "${h}". Use the template headers or spec:<key>[unit].` }));
  const seen = new Set<string>();
  const valid: { d: z.infer<typeof rowSchema>; categoryId: string; manufacturerId: string; taxClassId: string | null; specs: { key: string; unit: string | null; value: string }[] }[] = [];

  rows.forEach((raw, i) => {
    const rowNo = i + 2;
    const r = rowSchema.safeParse(raw);
    if (!r.success) {
      for (const iss of r.error.issues) errors.push({ row: rowNo, message: `${iss.path.join(".")}: ${iss.message}` });
      return;
    }
    const d = r.data;
    const msgs: string[] = [];
    if (seen.has(d.sku)) msgs.push(`duplicate sku ${d.sku} in file`);
    seen.add(d.sku);
    const cat = catBy.get(d.category);
    if (!cat) msgs.push(`unknown category "${d.category}"`);
    const mfr = mfrBy.get(d.manufacturer.toLowerCase());
    if (!mfr) msgs.push(`unknown manufacturer "${d.manufacturer}" (add it under Manufacturers first)`);
    const tax = d.tax_class ? taxBy.get(d.tax_class) : null;
    if (d.tax_class && !tax) msgs.push(`unknown tax class "${d.tax_class}"`);
    if (d.warranty_text && !d.warranty_source) msgs.push("warranty_text needs warranty_source");
    if (msgs.length) { msgs.forEach((m) => errors.push({ row: rowNo, message: m })); return; }
    const specs = specCols.map((c) => ({ key: c.key, unit: c.unit, value: String(raw[c.header] ?? "").trim() })).filter((s) => s.value !== "");
    valid.push({ d, categoryId: cat!.id, manufacturerId: mfr!.id, taxClassId: tax?.id ?? null, specs });
  });

  const willUpdate = valid.filter((v) => skuBy.has(v.d.sku)).length;
  const willCreate = valid.length - willUpdate;
  if (errors.length) {
    return { summary: `${errors.length} problem(s) found in ${rows.length} rows. Nothing was imported; fix the file and try again.`, errors, created: 0, updated: 0 };
  }
  if (!commit) {
    return { summary: `Preview: ${rows.length} rows are valid. ${willCreate} new product(s), ${willUpdate} update(s), ${specCols.length} specification column(s). Choose "Import" to write them.`, errors: [], created: 0, updated: 0 };
  }

  await prisma.$transaction(async (tx) => {
    for (const v of valid) {
      const { d } = v;
      const data = {
        name: d.name, model: d.model, description: d.description, categoryId: v.categoryId, manufacturerId: v.manufacturerId, taxClassId: v.taxClassId, unit: d.unit,
        availability: d.availability, leadTimeDays: d.lead_time_days == null ? null : Math.round(d.lead_time_days), warrantyText: d.warranty_text, warrantyProvenance: d.warranty_source,
        ipRating: d.ip_rating, material: d.material, dimensionsText: d.dimensions, weightKg: d.weight_kg == null ? null : new Prisma.Decimal(d.weight_kg),
        provenance: d.provenance, illustrative: d.provenance === "ILLUSTRATIVE",
      };
      const id = skuBy.get(d.sku);
      const p = id ? await tx.product.update({ where: { id }, data }) : await tx.product.create({ data: { ...data, sku: d.sku, status: "DRAFT" } });
      for (const s of v.specs) {
        const num = Number(s.value);
        const isNum = Number.isFinite(num);
        const specData = { valueNumber: isNum ? new Prisma.Decimal(num) : null, valueText: isNum ? null : s.value.slice(0, 300), unit: s.unit, provenance: d.provenance, sourceDocumentId: null, verifiedAt: null, verifiedBy: null };
        await tx.productSpecification.upsert({
          where: { productId_key: { productId: p.id, key: s.key } },
          update: specData,
          create: { productId: p.id, key: s.key, label: humanize(s.key), sortOrder: 50, ...specData },
        });
      }
      await audit(tx, actor, { entityType: "Product", entityId: p.id, action: id ? "import-update" : "import-create", newValue: `${d.sku} (${v.specs.length} specs) from ${fileName.slice(0, 100)}` });
    }
  }, { timeout: 60_000 });

  return { summary: `Imported ${valid.length} rows: ${willCreate} created as Draft (publish them from Products after review), ${willUpdate} updated.${willUpdate ? " Imported values on existing products replace any earlier verification and must be re-verified." : ""}`, errors: [], created: willCreate, updated: willUpdate };
}
