import { Prisma, type PrismaClient } from "@prisma/client";
import { priceBom, type PricingResult } from "@/lib/engine";
import type { EngineResult } from "@/lib/engine";
import type { z } from "zod";
import type { bomItemCreateSchema, bomItemPatchSchema } from "@/lib/validation";
import { audit, type Actor } from "./audit";
import { createRevision } from "./projects";

type Db = PrismaClient | Prisma.TransactionClient;
const dec = (v: number | null | undefined) => (v == null ? null : new Prisma.Decimal(v));
const num = (v: Prisma.Decimal | null | undefined) => (v == null ? null : Number(v));

export class BomError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

const isStaff = (a: Actor) => a.roles.length > 0;
const canVerify = (a: Actor) => a.roles.includes("ADMIN") || a.roles.includes("DESIGN_ENGINEER");
const canPrice = (a: Actor) => a.roles.includes("ADMIN") || a.roles.includes("PROCUREMENT") || a.roles.includes("SALES_ENGINEER");

export async function loadBom(db: Db, projectId: string) {
  const bom = await db.bOMHeader.findFirst({
    where: { projectId },
    orderBy: { createdAt: "asc" },
    include: {
      items: { orderBy: [{ lineNo: "asc" }, { updatedAt: "asc" }], include: { product: { include: { category: true } } } },
      costItems: true,
      revisions: { orderBy: { revisionNo: "desc" } },
      assignedTo: true,
    },
  });
  return bom;
}
export type LoadedBom = NonNullable<Awaited<ReturnType<typeof loadBom>>>;

export function bomPricing(bom: LoadedBom): PricingResult {
  const active = bom.items.filter((i) => !i.removed);
  return priceBom(
    active.map((i) => ({ id: i.id, section: i.section, quantity: num(i.procurementQty), unitPrice: num(i.unitPrice), gstRatePercent: num(i.gstRatePercent) })),
    bom.costItems.map((c) => ({ label: c.label, amount: num(c.amount), gstRatePercent: num(c.gstRatePercent) })),
    bom.pricesIncludeGst,
  );
}

export function engineSnapshot(bom: { calcSnapshot: Prisma.JsonValue }): (EngineResult & { skippedProducts?: string[] }) | null {
  return (bom.calcSnapshot as unknown as EngineResult & { skippedProducts?: string[] }) ?? null;
}

type Patch = z.infer<typeof bomItemPatchSchema>;
const AUDITED: (keyof Patch)[] = ["procurementQty", "unitPrice", "gstRatePercent", "quantityStatus", "specification", "technicalNotes", "supplierRemarks", "supplierName", "complianceReq", "complianceStatus", "availability", "name", "unit", "productId"];

/** Edit a BOM line. Every changed field is written to the audit log. */
export async function patchItem(db: PrismaClient, bomId: string, itemId: string, patch: Patch, actor: Actor) {
  if (patch.quantityStatus === "ENGINEER_VERIFIED" && !canVerify(actor)) throw new BomError("Only a design engineer can mark a quantity as engineer-verified.", 403);
  if (patch.complianceStatus === "VERIFIED" && !canVerify(actor)) throw new BomError("Only a design engineer can mark compliance as verified.", 403);
  if ((patch.gstRatePercent !== undefined) && !canPrice(actor)) throw new BomError("GST classification is set by staff.", 403);

  return db.$transaction(async (tx) => {
    const item = await tx.bOMItem.findFirst({ where: { id: itemId, bomId } });
    if (!item) throw new BomError("Line not found", 404);
    const data: Prisma.BOMItemUncheckedUpdateInput = {};
    for (const k of AUDITED) {
      if (patch[k] === undefined) continue;
      const before = (item as Record<string, unknown>)[k];
      const beforeVal = before instanceof Prisma.Decimal ? Number(before) : before ?? null;
      const after = patch[k] ?? null;
      if (beforeVal === after) continue;
      (data as Record<string, unknown>)[k] = typeof after === "number" ? new Prisma.Decimal(after) : after;
      await audit(tx, actor, { entityType: "BOMItem", entityId: item.id, action: "edit", field: k, oldValue: beforeVal, newValue: after, reason: patch.reason ?? undefined });
    }
    if (patch.unitPrice !== undefined) data.priceProvenance = canPrice(actor) ? "SUPPLIER_QUOTED" : "USER_ESTIMATE";
    // A quantity edit invalidates an earlier engineer verification unless the editor can verify.
    if (patch.procurementQty !== undefined && item.quantityStatus === "ENGINEER_VERIFIED" && !canVerify(actor) && data.procurementQty !== undefined) {
      data.quantityStatus = "ESTIMATED";
      await audit(tx, actor, { entityType: "BOMItem", entityId: item.id, action: "verification-reset", field: "quantityStatus", oldValue: "ENGINEER_VERIFIED", newValue: "ESTIMATED", reason: "Quantity edited by non-engineer" });
    }
    if (patch.productId !== undefined && patch.productId) {
      const p = await tx.product.findUnique({ where: { id: patch.productId }, include: { manufacturer: true, taxClass: true } });
      if (!p || p.status !== "ACTIVE") throw new BomError("Replacement product not found or not active", 422);
      Object.assign(data, { itemCode: p.sku, name: p.name, manufacturer: p.manufacturer.name, model: p.model, unit: p.unit, gstRatePercent: p.taxClass?.ratePercent ?? null, taxClassCode: p.taxClass?.code ?? null, availability: p.availability });
      if (item.quantityStatus === "ENGINEER_VERIFIED") data.quantityStatus = "ESTIMATED";
    }
    if (Object.keys(data).length === 0) return item;
    const updated = await tx.bOMItem.update({ where: { id: item.id }, data });
    await tx.bOMHeader.update({ where: { id: bomId }, data: { status: "DRAFT" } });
    return updated;
  });
}

export async function addItem(db: PrismaClient, bomId: string, input: z.infer<typeof bomItemCreateSchema>, actor: Actor) {
  return db.$transaction(async (tx) => {
    let base: Partial<Prisma.BOMItemUncheckedCreateInput> = {};
    if (input.productId) {
      const p = await tx.product.findUnique({ where: { id: input.productId }, include: { manufacturer: true, taxClass: true, category: true } });
      if (!p || p.status !== "ACTIVE") throw new BomError("Product not found or not active", 422);
      base = { productId: p.id, itemCode: p.sku, name: p.name, manufacturer: p.manufacturer.name, model: p.model, unit: p.unit, gstRatePercent: p.taxClass?.ratePercent ?? null, taxClassCode: p.taxClass?.code ?? null, availability: p.availability, section: p.category.bomSection ?? input.section };
    }
    const max = await tx.bOMItem.aggregate({ where: { bomId }, _max: { lineNo: true } });
    const item = await tx.bOMItem.create({
      data: {
        bomId, section: input.section, itemCode: `MAN-${Date.now().toString(36).toUpperCase()}`, name: input.name, unit: input.unit, specification: input.specification,
        ...base,
        lineNo: (max._max.lineNo ?? 0) + 1, calculatedQty: null, procurementQty: dec(input.procurementQty), quantityStatus: "ESTIMATED",
        quantityBasis: "Manual line added by user", isManual: true,
        unitPrice: dec(input.unitPrice), priceProvenance: input.unitPrice != null ? (canPrice(actor) ? "SUPPLIER_QUOTED" : "USER_ESTIMATE") : null,
      },
    });
    await audit(tx, actor, { entityType: "BOMItem", entityId: item.id, action: "create", newValue: `${item.name} × ${input.procurementQty ?? "?"} ${item.unit}`, reason: input.reason ?? "Manual line" });
    await tx.bOMHeader.update({ where: { id: bomId }, data: { status: "DRAFT" } });
    return item;
  });
}

export async function setRemoved(db: PrismaClient, bomId: string, itemId: string, removed: boolean, reason: string | null, actor: Actor) {
  return db.$transaction(async (tx) => {
    const item = await tx.bOMItem.findFirst({ where: { id: itemId, bomId } });
    if (!item) throw new BomError("Line not found", 404);
    await tx.bOMItem.update({ where: { id: itemId }, data: { removed } });
    await audit(tx, actor, { entityType: "BOMItem", entityId: itemId, action: removed ? "remove" : "restore", oldValue: item.removed, newValue: removed, reason: reason ?? undefined });
    await tx.bOMHeader.update({ where: { id: bomId }, data: { status: "DRAFT" } });
  });
}

export async function saveRevision(db: PrismaClient, bomId: string, summary: string, actor: Actor) {
  return db.$transaction((tx) => createRevision(tx, bomId, summary, actor));
}

export async function submitForReview(db: PrismaClient, bomId: string, actor: Actor) {
  return db.$transaction(async (tx) => {
    const bom = await tx.bOMHeader.findUniqueOrThrow({ where: { id: bomId } });
    const rev = await tx.bOMRevision.findUniqueOrThrow({ where: { bomId_revisionNo: { bomId, revisionNo: bom.currentRevision } } });
    if (rev.status !== "DRAFT") throw new BomError("This revision has already been submitted.");
    await tx.bOMRevision.update({ where: { id: rev.id }, data: { status: "SUBMITTED" } });
    await tx.bOMHeader.update({ where: { id: bomId }, data: { status: "SUBMITTED" } });
    await audit(tx, actor, { entityType: "BOMRevision", entityId: rev.id, action: "submit", newValue: "SUBMITTED" });
  });
}

export async function reviewRevision(db: PrismaClient, revisionId: string, decision: "APPROVED" | "REJECTED", notes: string | null, actor: Actor) {
  if (!canVerify(actor)) throw new BomError("Only design engineers can approve or reject engineering changes.", 403);
  return db.$transaction(async (tx) => {
    const rev = await tx.bOMRevision.findUniqueOrThrow({ where: { id: revisionId }, include: { bom: true } });
    if (rev.status !== "SUBMITTED") throw new BomError("Only submitted revisions can be reviewed.");
    await tx.bOMRevision.update({ where: { id: rev.id }, data: { status: decision, reviewedBy: actor.label, reviewedAt: new Date(), reviewNotes: notes } });
    if (rev.bom.currentRevision === rev.revisionNo) await tx.bOMHeader.update({ where: { id: rev.bomId }, data: { status: decision } });
    await audit(tx, actor, { entityType: "BOMRevision", entityId: rev.id, action: decision.toLowerCase(), newValue: decision, reason: notes ?? undefined });
  });
}

export async function setCostItems(db: PrismaClient, bomId: string, items: { label: string; amount: number | null; gstRatePercent: number | null; notes?: string | null }[], pricesIncludeGst: boolean, actor: Actor) {
  if (!isStaff(actor) && items.some((i) => i.gstRatePercent != null)) throw new BomError("GST rates for additional costs are set by staff.", 403);
  return db.$transaction(async (tx) => {
    const before = await tx.bOMHeader.findUniqueOrThrow({ where: { id: bomId }, include: { costItems: true } });
    await tx.projectCostItem.deleteMany({ where: { bomId } });
    for (const i of items) await tx.projectCostItem.create({ data: { bomId, label: i.label, amount: dec(i.amount), gstRatePercent: dec(i.gstRatePercent), notes: i.notes ?? null } });
    await tx.bOMHeader.update({ where: { id: bomId }, data: { pricesIncludeGst, status: "DRAFT" } });
    await audit(tx, actor, { entityType: "BOMHeader", entityId: bomId, action: "edit", field: "costItems",
      oldValue: before.costItems.map((c) => `${c.label}: ${c.amount ?? "—"}`).join("; "), newValue: items.map((c) => `${c.label}: ${c.amount ?? "—"}`).join("; ") });
    if (before.pricesIncludeGst !== pricesIncludeGst) await audit(tx, actor, { entityType: "BOMHeader", entityId: bomId, action: "edit", field: "pricesIncludeGst", oldValue: before.pricesIncludeGst, newValue: pricesIncludeGst });
  });
}
