"use server";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/server/audit";
import { guarded, type ActionResult } from "@/lib/server/admin-guard";
import { ALLOWED_UPLOAD_TYPES, MAX_UPLOAD_BYTES, saveFile, sniffType } from "@/lib/server/storage";
import { importProducts } from "@/lib/server/import";
import { LOCKED_COMPAT_RULES } from "@/lib/engine/rules";

// ---------- helpers ----------
const s = (max = 300) => z.preprocess((v) => (v === "" || v == null ? null : String(v).trim()), z.string().max(max).nullable());
const req = (label: string, max = 300) => z.string({ required_error: `${label} is required` }).trim().min(1, `${label} is required`).max(max);
const n = (min = 0, max = 1e12) => z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number({ invalid_type_error: "Must be a number" }).min(min).max(max).nullable());
const int = (min = 0, max = 1e6) => z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().int().min(min).max(max).nullable());
const date = z.preprocess((v) => (v === "" || v == null ? null : new Date(String(v))), z.date().nullable());
const bool = z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean());
const provenance = z.enum(["MANUFACTURER_VERIFIED", "SUPPLIER_QUOTED", "ENGINEER_ENTERED", "USER_ESTIMATE", "ILLUSTRATIVE"]);
const verification = z.enum(["PENDING_VERIFICATION", "UNDER_ENGINEERING_REVIEW", "VERIFIED", "NOT_APPLICABLE", "REQUIRES_CORRECTIVE_ACTION"]);
const dec = (v: number | null) => (v == null ? null : new Prisma.Decimal(v));
const form = (fd: FormData) => Object.fromEntries(fd.entries());

/** Record field-level changes between two plain objects. */
async function diffAudit(tx: Prisma.TransactionClient, actor: Parameters<typeof audit>[1], entityType: string, entityId: string, before: Record<string, unknown> | null, after: Record<string, unknown>) {
  for (const [k, v] of Object.entries(after)) {
    const b = before?.[k];
    const norm = (x: unknown) => (x instanceof Prisma.Decimal ? Number(x) : x instanceof Date ? x.toISOString() : x ?? null);
    if (JSON.stringify(norm(b)) !== JSON.stringify(norm(v))) await audit(tx, actor, { entityType, entityId, action: before ? "update" : "create", field: k, oldValue: norm(b), newValue: norm(v) });
  }
}

// ---------- Products ----------
const productSchema = z.object({
  id: s(64), sku: req("SKU", 64).regex(/^[A-Za-z0-9._-]+$/, "Letters, digits, dot, dash and underscore only"), name: req("Name"), model: req("Model", 120),
  description: s(4000), categoryId: req("Category", 64), manufacturerId: req("Manufacturer", 64), taxClassId: s(64), unit: req("Unit", 20),
  availability: z.enum(["IN_STOCK", "LEAD_TIME", "ON_REQUEST", "DISCONTINUED", "UNKNOWN"]), leadTimeDays: int(0, 3650),
  warrantyText: s(500), warrantyProvenance: z.preprocess((v) => (v === "" ? null : v), provenance.nullable()),
  ipRating: s(20), material: s(200), dimensionsText: s(200), weightKg: n(0, 100000), imageUrl: s(500), provenance, illustrative: bool,
});

export async function saveProduct(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return guarded("products.edit", async (actor) => {
    const d = productSchema.parse(form(fd));
    if (d.warrantyText && !d.warrantyProvenance) return { ok: false, message: "State the source of the warranty information.", errors: { warrantyProvenance: "Required with warranty" } };
    if (d.imageUrl && !/^(https:\/\/|\/)/.test(d.imageUrl)) return { ok: false, message: "Image URL must be https or a site path." };
    const { id, ...data } = d;
    const payload = { ...data, weightKg: dec(data.weightKg) };
    await prisma.$transaction(async (tx) => {
      if (id) {
        const before = await tx.product.findUniqueOrThrow({ where: { id } });
        await tx.product.update({ where: { id }, data: payload });
        await diffAudit(tx, actor, "Product", id, before as unknown as Record<string, unknown>, payload);
      } else {
        const p = await tx.product.create({ data: { ...payload, status: "ACTIVE" } });
        await audit(tx, actor, { entityType: "Product", entityId: p.id, action: "create", newValue: p.sku });
      }
    });
    revalidatePath("/admin/products");
    revalidatePath("/catalogue");
    return { ok: true, message: id ? "Product updated." : "Product created." };
  });
}

export async function setProductStatus(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return guarded("products.edit", async (actor) => {
    const { id, status } = z.object({ id: req("id"), status: z.enum(["ACTIVE", "DRAFT", "ARCHIVED"]) }).parse(form(fd));
    const before = await prisma.product.findUniqueOrThrow({ where: { id } });
    await prisma.product.update({ where: { id }, data: { status } });
    await audit(prisma, actor, { entityType: "Product", entityId: id, action: "status", field: "status", oldValue: before.status, newValue: status });
    revalidatePath("/admin/products");
    return { ok: true, message: `Product ${status.toLowerCase()}.` };
  });
}

const specSchema = z.object({
  productId: req("Product"), key: req("Key", 60).regex(/^[a-z0-9_]+$/, "Lowercase letters, digits and underscores"), label: req("Label", 120),
  value: req("Value", 300), unit: s(30), tolerance: s(60), provenance, sourceDocumentId: s(64), verifiedAt: date,
});
export async function saveSpec(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return guarded("products.specs", async (actor) => {
    const d = specSchema.parse(form(fd));
    if (d.provenance === "MANUFACTURER_VERIFIED" && (!d.sourceDocumentId || !d.verifiedAt)) {
      return { ok: false, message: "Manufacturer-verified values need a source datasheet and a verification date." };
    }
    const asNum = Number(d.value);
    const data = {
      label: d.label, valueNumber: Number.isFinite(asNum) && d.value.trim() !== "" ? new Prisma.Decimal(asNum) : null, valueText: Number.isFinite(asNum) ? null : d.value,
      unit: d.unit, tolerance: d.tolerance, provenance: d.provenance, sourceDocumentId: d.sourceDocumentId, verifiedAt: d.verifiedAt, verifiedBy: d.verifiedAt ? actor.label : null,
    };
    await prisma.$transaction(async (tx) => {
      const before = await tx.productSpecification.findUnique({ where: { productId_key: { productId: d.productId, key: d.key } } });
      const row = await tx.productSpecification.upsert({ where: { productId_key: { productId: d.productId, key: d.key } }, update: data, create: { productId: d.productId, key: d.key, sortOrder: 99, ...data } });
      await diffAudit(tx, actor, "ProductSpecification", row.id, before as unknown as Record<string, unknown> | null, data);
    });
    revalidatePath(`/admin/products/${d.productId}`);
    return { ok: true, message: `Specification ${d.key} saved.` };
  });
}

export async function deleteSpec(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return guarded("products.specs", async (actor) => {
    const { id } = z.object({ id: req("id") }).parse(form(fd));
    const spec = await prisma.productSpecification.delete({ where: { id } });
    await audit(prisma, actor, { entityType: "ProductSpecification", entityId: id, action: "delete", oldValue: `${spec.key}=${spec.valueNumber ?? spec.valueText}` });
    revalidatePath(`/admin/products/${spec.productId}`);
    return { ok: true, message: "Specification removed." };
  });
}

const priceSchema = z.object({
  productId: req("Product"), priceListId: req("Price list"), supplierId: s(64), unitPrice: z.preprocess((v) => Number(v), z.number({ invalid_type_error: "Unit price is required" }).positive("Unit price must be positive")),
  quoteRef: req("Quotation reference", 120), validTo: date, leadTimeDays: int(0, 3650), provenance: z.enum(["SUPPLIER_QUOTED", "ENGINEER_ENTERED", "USER_ESTIMATE"]),
});
export async function savePrice(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return guarded("pricing.edit", async (actor) => {
    const d = priceSchema.parse(form(fd));
    await prisma.$transaction(async (tx) => {
      const existing = await tx.priceListEntry.findFirst({ where: { priceListId: d.priceListId, productId: d.productId, supplierId: d.supplierId } });
      const data = { unitPrice: new Prisma.Decimal(d.unitPrice), quoteRef: d.quoteRef, validTo: d.validTo, leadTimeDays: d.leadTimeDays, provenance: d.provenance };
      const row = existing
        ? await tx.priceListEntry.update({ where: { id: existing.id }, data })
        : await tx.priceListEntry.create({ data: { ...data, priceListId: d.priceListId, productId: d.productId, supplierId: d.supplierId } });
      await diffAudit(tx, actor, "PriceListEntry", row.id, existing as unknown as Record<string, unknown> | null, data);
    });
    revalidatePath(`/admin/products/${d.productId}`);
    return { ok: true, message: "Price saved." };
  });
}

export async function deletePrice(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return guarded("pricing.edit", async (actor) => {
    const { id } = z.object({ id: req("id") }).parse(form(fd));
    const e = await prisma.priceListEntry.delete({ where: { id } });
    await audit(prisma, actor, { entityType: "PriceListEntry", entityId: id, action: "delete", oldValue: Number(e.unitPrice) });
    revalidatePath(`/admin/products/${e.productId}`);
    return { ok: true, message: "Price removed." };
  });
}

export async function saveCompatibility(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return guarded("compatibility.edit", async (actor) => {
    const d = z.object({ productAId: req("Product"), productBId: req("Other product"), compatible: z.enum(["true", "false"]), notes: s(500) }).parse(form(fd));
    if (d.productAId === d.productBId) return { ok: false, message: "Choose a different product." };
    const [a, b] = [d.productAId, d.productBId].sort();
    const row = await prisma.productCompatibility.upsert({
      where: { productAId_productBId: { productAId: a, productBId: b } },
      update: { compatible: d.compatible === "true", notes: d.notes, verifiedAt: new Date() },
      create: { productAId: a, productBId: b, compatible: d.compatible === "true", notes: d.notes, verifiedAt: new Date() },
    });
    await audit(prisma, actor, { entityType: "ProductCompatibility", entityId: row.id, action: "upsert", newValue: `${d.compatible === "true" ? "compatible" : "incompatible"}: ${d.notes ?? ""}` });
    revalidatePath(`/admin/products/${d.productAId}`);
    return { ok: true, message: "Compatibility record saved." };
  });
}

export async function saveCertification(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return guarded("compliance.edit", async (actor) => {
    const d = z.object({ productId: req("Product"), standardId: req("Standard"), certificateNo: s(120), documentId: s(64), validUntil: date, verificationStatus: verification, notes: s(500) }).parse(form(fd));
    if (d.verificationStatus === "VERIFIED" && !d.documentId) return { ok: false, message: "Attach the certificate document before marking a certification as verified." };
    const data = { certificateNo: d.certificateNo, documentId: d.documentId, validUntil: d.validUntil, verificationStatus: d.verificationStatus, notes: d.notes, verifiedAt: d.verificationStatus === "VERIFIED" ? new Date() : null };
    const row = await prisma.productCertification.upsert({ where: { productId_standardId: { productId: d.productId, standardId: d.standardId } }, update: data, create: { productId: d.productId, standardId: d.standardId, ...data } });
    await audit(prisma, actor, { entityType: "ProductCertification", entityId: row.id, action: "upsert", newValue: d.verificationStatus });
    revalidatePath(`/admin/products/${d.productId}`);
    return { ok: true, message: "Certification saved." };
  });
}

export async function uploadDocument(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return guarded("documents.upload", async (actor) => {
    const d = z.object({
      title: req("Title", 200), docType: z.enum(["DATASHEET", "CERTIFICATE", "REGULATION", "APPROVAL", "TEST_REPORT", "OTHER"]), revision: s(60), issuedAt: date, expiresAt: date,
      productId: s(64), standardId: s(64), projectId: s(64), externalUrl: s(500),
    }).parse(Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string")));
    const file = fd.get("file");
    let stored: { storageKey: string; fileName: string; mimeType: string; sizeBytes: number } | null = null;
    if (file instanceof File && file.size > 0) {
      if (file.size > MAX_UPLOAD_BYTES) return { ok: false, message: "File is larger than 15 MB." };
      const buf = Buffer.from(await file.arrayBuffer());
      const type = sniffType(buf);
      if (!type || !ALLOWED_UPLOAD_TYPES[type]) return { ok: false, message: "Only PDF, PNG and JPEG files are accepted." };
      stored = { storageKey: await saveFile(buf, ALLOWED_UPLOAD_TYPES[type], "documents"), fileName: file.name.slice(0, 200), mimeType: type, sizeBytes: buf.length };
    }
    if (!stored && !d.externalUrl) return { ok: false, message: "Attach a file or give an official link." };
    if (d.externalUrl && !d.externalUrl.startsWith("https://")) return { ok: false, message: "Links must start with https://" };
    const doc = await prisma.complianceDocument.create({ data: { ...d, ...(stored ?? {}), uploadedBy: actor.label } });
    await audit(prisma, actor, { entityType: "ComplianceDocument", entityId: doc.id, action: "upload", newValue: `${d.docType}: ${d.title}` });
    if (d.productId) revalidatePath(`/admin/products/${d.productId}`);
    revalidatePath("/admin/compliance");
    return { ok: true, message: "Document stored." };
  });
}

// ---------- Reference data ----------
export async function saveManufacturer(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return guarded("manufacturers.edit", async (actor) => {
    const d = z.object({ id: s(64), name: req("Name", 200), website: s(300), country: s(80), notes: s(1000), archived: bool }).parse(form(fd));
    if (d.website && !d.website.startsWith("https://")) return { ok: false, message: "Website must start with https://" };
    const { id, ...data } = d;
    const row = id ? await prisma.manufacturer.update({ where: { id }, data }) : await prisma.manufacturer.create({ data });
    await audit(prisma, actor, { entityType: "Manufacturer", entityId: row.id, action: id ? "update" : "create", newValue: JSON.stringify(data) });
    revalidatePath("/admin/manufacturers");
    return { ok: true, message: "Manufacturer saved." };
  });
}

export async function saveSupplier(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return guarded("suppliers.edit", async (actor) => {
    const d = z.object({
      id: s(64), name: req("Name", 200), contactName: s(120), email: z.preprocess((v) => (v === "" ? null : v), z.string().email("Invalid email").nullable()), phone: s(30), city: s(80),
      gstin: z.preprocess((v) => (v === "" ? null : String(v).toUpperCase()), z.string().regex(/^[0-9A-Z]{15}$/, "GSTIN must be 15 characters").nullable()), notes: s(1000), archived: bool,
    }).parse(form(fd));
    const { id, ...data } = d;
    const row = id ? await prisma.supplier.update({ where: { id }, data }) : await prisma.supplier.create({ data });
    await audit(prisma, actor, { entityType: "Supplier", entityId: row.id, action: id ? "update" : "create", newValue: data.name });
    revalidatePath("/admin/suppliers");
    return { ok: true, message: "Supplier saved." };
  });
}

export async function saveCategory(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return guarded("categories.edit", async (actor) => {
    const d = z.object({ id: s(64), slug: req("Slug", 60).regex(/^[a-z0-9-]+$/, "lowercase-with-dashes"), name: req("Name", 120), description: s(1000), sortOrder: int(0, 1000),
      bomSection: s(30), archived: bool }).parse(form(fd));
    const { id, ...data } = d;
    const payload = { ...data, sortOrder: data.sortOrder ?? 0 };
    const row = id ? await prisma.productCategory.update({ where: { id }, data: payload }) : await prisma.productCategory.create({ data: payload });
    await audit(prisma, actor, { entityType: "ProductCategory", entityId: row.id, action: id ? "update" : "create", newValue: data.name });
    revalidatePath("/admin/categories");
    return { ok: true, message: "Category saved." };
  });
}

// ---------- Pricing & tax ----------
export async function saveTaxClass(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return guarded("tax.edit", async (actor) => {
    const d = z.object({ id: s(64), code: req("Code", 40), description: req("Description", 200), hsnSac: s(20), ratePercent: n(0, 100), verificationStatus: verification, sourceNote: s(1000), sourceUrl: s(500) }).parse(form(fd));
    if (d.ratePercent != null && !d.sourceNote) return { ok: false, message: "Record the notification or source for the GST rate." };
    const { id, ...rest } = d;
    const data = { ...rest, ratePercent: dec(rest.ratePercent), verifiedAt: rest.verificationStatus === "VERIFIED" ? new Date() : null };
    await prisma.$transaction(async (tx) => {
      const before = id ? await tx.taxClass.findUnique({ where: { id } }) : null;
      const row = id ? await tx.taxClass.update({ where: { id }, data }) : await tx.taxClass.create({ data });
      await diffAudit(tx, actor, "TaxClass", row.id, before as unknown as Record<string, unknown> | null, data);
    });
    revalidatePath("/admin/pricing");
    return { ok: true, message: "Tax class saved. Existing BOM lines keep their rate until a staff member updates them or the product is re-selected." };
  });
}

export async function savePriceList(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return guarded("pricing.edit", async (actor) => {
    const d = z.object({ id: s(64), name: req("Name", 120), validFrom: date, validTo: date, pricesIncludeGst: bool, active: bool, notes: s(1000) }).parse(form(fd));
    const { id, ...data } = d;
    const row = id ? await prisma.priceList.update({ where: { id }, data }) : await prisma.priceList.create({ data });
    await audit(prisma, actor, { entityType: "PriceList", entityId: row.id, action: id ? "update" : "create", newValue: JSON.stringify(data) });
    revalidatePath("/admin/pricing");
    return { ok: true, message: "Price list saved." };
  });
}

export async function saveService(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return guarded("pricing.edit", async (actor) => {
    const d = z.object({ id: req("id"), name: req("Name", 200), unitPrice: n(0, 1e10), active: bool }).parse(form(fd));
    const before = await prisma.installationService.findUniqueOrThrow({ where: { id: d.id } });
    await prisma.installationService.update({ where: { id: d.id }, data: { name: d.name, unitPrice: dec(d.unitPrice), active: d.active } });
    await audit(prisma, actor, { entityType: "InstallationService", entityId: d.id, action: "update", field: "unitPrice", oldValue: before.unitPrice == null ? null : Number(before.unitPrice), newValue: d.unitPrice });
    revalidatePath("/admin/pricing");
    return { ok: true, message: "Service saved." };
  });
}

// ---------- Rules ----------
export async function saveRule(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return guarded("rules.edit", async (actor) => {
    const d = z.object({ id: req("id"), valueNumber: n(-1e6, 1e6), isAssumption: bool, reason: req("Reason for change", 500) }).parse(form(fd));
    const before = await prisma.engineRule.findUniqueOrThrow({ where: { id: d.id } });
    await prisma.engineRule.update({ where: { id: d.id }, data: { valueNumber: dec(d.valueNumber), isAssumption: d.isAssumption, updatedBy: actor.label, provenance: "ENGINEER_ENTERED" } });
    await audit(prisma, actor, { entityType: "EngineRule", entityId: d.id, action: "update", field: before.key, oldValue: before.valueNumber == null ? null : Number(before.valueNumber), newValue: d.valueNumber, reason: d.reason });
    revalidatePath("/admin/rules");
    return { ok: true, message: `${before.label} updated. Existing BOMs change only when recalculated.` };
  });
}

export async function toggleCompatRule(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return guarded("rules.edit", async (actor) => {
    const d = z.object({ id: req("id"), enabled: z.enum(["true", "false"]), severity: z.enum(["error", "warning"]) }).parse(form(fd));
    const cur = await prisma.compatibilityRule.findUniqueOrThrow({ where: { id: d.id } });
    if (LOCKED_COMPAT_RULES.includes(cur.key) && (d.enabled === "false" || d.severity !== "error")) return { ok: false, message: "This check protects equipment voltage and current limits and cannot be relaxed." };
    const r = await prisma.compatibilityRule.update({ where: { id: d.id }, data: { enabled: d.enabled === "true", severity: d.severity } });
    await audit(prisma, actor, { entityType: "CompatibilityRule", entityId: d.id, action: "update", newValue: `${r.key}: ${d.enabled}/${d.severity}` });
    revalidatePath("/admin/rules");
    return { ok: true, message: "Compatibility rule saved." };
  });
}

// ---------- Compliance ----------
export async function saveStandard(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return guarded("compliance.edit", async (actor) => {
    const d = z.object({ id: s(64), code: req("Code", 60), title: req("Title", 300), authority: req("Authority", 60), scope: req("Scope", 120), officialUrl: s(500), revision: s(120), revisionDate: date,
      applicabilityNotes: s(4000), verificationStatus: verification, active: bool }).parse(form(fd));
    if (d.officialUrl && !d.officialUrl.startsWith("https://")) return { ok: false, message: "Official URL must start with https://" };
    if (d.verificationStatus === "VERIFIED" && (!d.revision || !d.revisionDate)) return { ok: false, message: "Record the revision and revision date before marking a source as verified." };
    const { id, ...rest } = d;
    const data = { ...rest, verifiedAt: rest.verificationStatus === "VERIFIED" ? new Date() : null, verifiedBy: rest.verificationStatus === "VERIFIED" ? actor.label : null };
    await prisma.$transaction(async (tx) => {
      const before = id ? await tx.complianceStandard.findUnique({ where: { id } }) : null;
      const row = id ? await tx.complianceStandard.update({ where: { id }, data }) : await tx.complianceStandard.create({ data });
      await diffAudit(tx, actor, "ComplianceStandard", row.id, before as unknown as Record<string, unknown> | null, data);
    });
    revalidatePath("/admin/compliance");
    return { ok: true, message: "Compliance source saved." };
  });
}

export async function saveCheckTemplate(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return guarded("compliance.edit", async (actor) => {
    const d = z.object({ id: s(64), key: req("Key", 60).regex(/^[a-z0-9_]+$/), title: req("Title", 200), area: req("Area", 80), description: req("Description", 2000), standardId: s(64), sortOrder: int(0, 1000), active: bool }).parse(form(fd));
    const { id, ...data } = d;
    const payload = { ...data, sortOrder: data.sortOrder ?? 0 };
    const row = id ? await prisma.complianceCheckTemplate.update({ where: { id }, data: payload }) : await prisma.complianceCheckTemplate.create({ data: payload });
    await audit(prisma, actor, { entityType: "ComplianceCheckTemplate", entityId: row.id, action: id ? "update" : "create", newValue: d.title });
    revalidatePath("/admin/compliance");
    return { ok: true, message: "Checklist item saved. New projects will include it; existing projects get it when their checklist is refreshed." };
  });
}

export async function updateComplianceItem(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return guarded("compliance.edit", async (actor) => {
    const d = z.object({ id: req("id"), status: verification, notes: s(2000), evidenceDocumentId: s(64) }).parse(form(fd));
    if (d.status === "VERIFIED" && !d.evidenceDocumentId) return { ok: false, message: "Attach evidence (an uploaded or linked source document) before marking an item as verified." };
    if (d.status === "REQUIRES_CORRECTIVE_ACTION" && !d.notes) return { ok: false, message: "Describe the corrective action required." };
    const before = await prisma.projectComplianceItem.findUniqueOrThrow({ where: { id: d.id } });
    await prisma.projectComplianceItem.update({ where: { id: d.id }, data: { status: d.status, notes: d.notes, evidenceDocumentId: d.evidenceDocumentId, reviewedBy: actor.label, reviewedAt: new Date() } });
    await audit(prisma, actor, { entityType: "ProjectComplianceItem", entityId: before.projectId, action: "compliance", field: before.templateId, oldValue: before.status, newValue: d.status, reason: d.notes ?? undefined });
    revalidatePath(`/projects/${before.projectId}/compliance`);
    return { ok: true, message: "Checklist item updated." };
  });
}

export async function refreshChecklist(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return guarded("compliance.edit", async () => {
    const { projectId } = z.object({ projectId: req("Project") }).parse(form(fd));
    const p = await prisma.project.findUniqueOrThrow({ where: { id: projectId }, include: { designInputs: true } });
    const { initComplianceChecklist } = await import("@/lib/server/projects");
    await initComplianceChecklist(prisma, projectId, p.designInputs?.roofType ?? null);
    revalidatePath(`/projects/${projectId}/compliance`);
    return { ok: true, message: "Checklist refreshed with any new template items." };
  });
}

// ---------- Enquiries, projects ----------
export async function updateEnquiry(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return guarded("enquiries.manage", async (actor) => {
    const d = z.object({ id: req("id"), status: z.enum(["NEW", "IN_PROGRESS", "CLOSED"]), assignedTo: s(64) }).parse(form(fd));
    const before = await prisma.enquiry.findUniqueOrThrow({ where: { id: d.id } });
    await prisma.enquiry.update({ where: { id: d.id }, data: { status: d.status, assignedTo: d.assignedTo } });
    await diffAudit(prisma as unknown as Prisma.TransactionClient, actor, "Enquiry", d.id, before as unknown as Record<string, unknown>, { status: d.status, assignedTo: d.assignedTo });
    revalidatePath("/admin/enquiries");
    return { ok: true, message: "Enquiry updated." };
  });
}

export async function assignBom(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return guarded("projects.assign", async (actor) => {
    const d = z.object({ bomId: req("BOM"), userId: s(64) }).parse(form(fd));
    const before = await prisma.bOMHeader.findUniqueOrThrow({ where: { id: d.bomId }, include: { assignedTo: true } });
    const user = d.userId ? await prisma.user.findUniqueOrThrow({ where: { id: d.userId } }) : null;
    await prisma.bOMHeader.update({ where: { id: d.bomId }, data: { assignedToId: d.userId } });
    await audit(prisma, actor, { entityType: "BOMHeader", entityId: d.bomId, action: "assign", oldValue: before.assignedTo?.name ?? null, newValue: user?.name ?? null });
    revalidatePath("/admin/projects");
    return { ok: true, message: user ? `Assigned to ${user.name}.` : "Unassigned." };
  });
}

// ---------- Users ----------
export async function saveUser(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return guarded("users.manage", async (actor) => {
    const d = z.object({ id: s(64), email: z.string().trim().toLowerCase().email("Invalid email"), name: req("Name", 120), password: s(200), active: bool }).parse(form(fd));
    const roles = fd.getAll("roles").map(String).filter((r) => ["ADMIN", "SALES_ENGINEER", "DESIGN_ENGINEER", "PROCUREMENT"].includes(r));
    if (!roles.length) return { ok: false, message: "Choose at least one role." };
    if (!d.id && (!d.password || d.password.length < 12)) return { ok: false, message: "New users need a password of at least 12 characters." };
    if (d.password && d.password.length < 12) return { ok: false, message: "Passwords must be at least 12 characters." };
    if (d.id === actor.userId && (!d.active || !roles.includes("ADMIN"))) return { ok: false, message: "You cannot remove your own admin access or deactivate yourself." };
    await prisma.$transaction(async (tx) => {
      const data = { email: d.email, name: d.name, active: d.active, ...(d.password ? { passwordHash: await bcrypt.hash(d.password, 12) } : {}) };
      const u = d.id ? await tx.user.update({ where: { id: d.id }, data }) : await tx.user.create({ data: { ...data, passwordHash: data.passwordHash! } });
      const allRoles = await tx.role.findMany();
      await tx.userRole.deleteMany({ where: { userId: u.id } });
      for (const r of allRoles.filter((r) => roles.includes(r.code))) await tx.userRole.create({ data: { userId: u.id, roleId: r.id } });
      await audit(tx, actor, { entityType: "User", entityId: u.id, action: d.id ? "update" : "create", newValue: `${u.email}: ${roles.join(", ")}${d.active ? "" : " (inactive)"}${d.password ? " · password set" : ""}` });
    });
    revalidatePath("/admin/users");
    return { ok: true, message: "User saved." };
  });
}

// ---------- Import ----------
export async function runImport(_p: ActionResult | null, fd: FormData): Promise<ActionResult & { preview?: unknown }> {
  return guarded("products.import", async (actor) => {
    const file = fd.get("file");
    const commit = fd.get("commit") === "true";
    if (!(file instanceof File) || file.size === 0) return { ok: false, message: "Choose a CSV or XLSX file." };
    if (file.size > 5 * 1024 * 1024) return { ok: false, message: "File is larger than 5 MB." };
    const result = await importProducts(Buffer.from(await file.arrayBuffer()), file.name, commit, actor);
    if (commit) revalidatePath("/admin/products");
    const byRow: Record<string, string> = {};
    for (const e of result.errors.slice(0, 200)) byRow[`row ${e.row}`] = byRow[`row ${e.row}`] ? `${byRow[`row ${e.row}`]}; ${e.message}` : e.message;
    return { ok: result.errors.length === 0, message: result.summary, errors: byRow };
  });
}
