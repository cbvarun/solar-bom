import { Prisma, type PrismaClient } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { generateBom, type EngineResult, type ProjectInputs } from "@/lib/engine";
import type { ProjectForm } from "@/lib/validation";
import { audit, SYSTEM, type Actor } from "./audit";
import { loadEngineCatalogue, loadRules } from "./engine-data";

type Db = PrismaClient | Prisma.TransactionClient;

const dec = (v: number | null | undefined) => (v == null ? null : new Prisma.Decimal(v));
const num = (v: Prisma.Decimal | null | undefined) => (v == null ? null : Number(v));

export const projectInclude = { designInputs: true, boms: { orderBy: { createdAt: "asc" } } } as const;
export type ProjectWithInputs = Prisma.ProjectGetPayload<{ include: typeof projectInclude }>;

async function nextReference(db: Db): Promise<string> {
  const year = new Date().getFullYear();
  const count = await db.project.count({ where: { reference: { startsWith: `SP-${year}-` } } });
  return `SP-${year}-${String(count + 1).padStart(4, "0")}`;
}

function designInputData(f: ProjectForm) {
  return {
    targetCapacityKwp: dec(f.targetCapacityKwp), roofType: f.roofType, roofAreaM2: dec(f.roofAreaM2), isExpansion: f.isExpansion,
    systemType: f.systemType, supplyPhase: f.supplyPhase, sanctionedLoad: dec(f.sanctionedLoad), sanctionedLoadUnit: f.sanctionedLoadUnit,
    exportArrangement: f.exportArrangement, preferredModuleWp: f.preferredModuleWp, preferredModuleMfrId: f.preferredModuleMfrId,
    preferredInverterMfrId: f.preferredInverterMfrId, mountingMaterial: f.mountingMaterial, preferredConfiguration: f.preferredConfiguration,
    budgetRange: f.budgetRange, monitoring: f.monitoring, selectedModuleId: f.selectedModuleId, selectedInverterId: f.selectedInverterId,
    selectedStructureId: f.selectedStructureId,
    engineering: (f.engineering ?? {}) as Prisma.InputJsonValue,
    inputMeta: (f.inputMeta ?? {}) as Prisma.InputJsonValue,
  };
}

/** Initialise a project's compliance checklist from the active templates. Statuses start as pending. */
export async function initComplianceChecklist(db: Db, projectId: string, roofType: string | null) {
  const templates = await db.complianceCheckTemplate.findMany({ where: { active: true } });
  for (const t of templates) {
    const applies = t.appliesTo as { roofTypes?: string[] } | null;
    const notApplicable = applies?.roofTypes && roofType && !applies.roofTypes.includes(roofType);
    await db.projectComplianceItem.upsert({
      where: { projectId_templateId: { projectId, templateId: t.id } },
      update: {},
      create: { projectId, templateId: t.id, status: "PENDING_VERIFICATION", notes: notApplicable ? "Template not normally applicable to this roof type — engineering to confirm." : null },
    });
  }
}

export async function createProject(db: PrismaClient, f: ProjectForm, actor: Actor, opts: { isSample?: boolean } = {}) {
  const ownerToken = randomBytes(18).toString("base64url");
  const project = await db.$transaction(async (tx) => {
    const p = await tx.project.create({
      data: {
        reference: await nextReference(tx), name: f.name, location: f.location, customerType: f.customerType,
        customerName: f.customerName, customerEmail: f.customerEmail, customerPhone: f.customerPhone,
        ownerToken, isSample: opts.isSample ?? false, createdById: actor.userId,
        designInputs: { create: designInputData(f) },
        boms: { create: { title: "Preliminary BOM" } },
      },
    });
    await audit(tx, actor, { entityType: "Project", entityId: p.id, action: "create", newValue: f.name });
    await initComplianceChecklist(tx, p.id, f.roofType);
    return p;
  });
  await generateAndSaveBom(db, project.id, actor, "Generated from new project configuration");
  return { project, ownerToken };
}

export async function updateProject(db: PrismaClient, id: string, f: ProjectForm, actor: Actor) {
  await db.$transaction(async (tx) => {
    const before = await tx.project.findUniqueOrThrow({ where: { id }, include: { designInputs: true } });
    await tx.project.update({
      where: { id },
      data: { name: f.name, location: f.location, customerType: f.customerType, customerName: f.customerName, customerEmail: f.customerEmail, customerPhone: f.customerPhone },
    });
    const data = designInputData(f);
    await tx.projectDesignInputs.upsert({ where: { projectId: id }, update: data, create: { projectId: id, ...data } });
    // Record each changed design input.
    const prev = before.designInputs as Record<string, unknown> | null;
    for (const [k, v] of Object.entries(data)) {
      const old = prev?.[k];
      const a = old == null ? null : JSON.stringify(old instanceof Prisma.Decimal ? Number(old) : old);
      const b = v == null ? null : JSON.stringify(v instanceof Prisma.Decimal ? Number(v) : v);
      if (a !== b) await audit(tx, actor, { entityType: "ProjectDesignInputs", entityId: id, action: "update", field: k, oldValue: a, newValue: b });
    }
  });
  return generateAndSaveBom(db, id, actor, "Regenerated after configuration change");
}

export function toEngineInputs(p: ProjectWithInputs, mfrNames: Record<string, string>): ProjectInputs {
  const d = p.designInputs;
  if (!d) return {};
  const sanctionedKw = d.sanctionedLoadUnit === "kW" ? num(d.sanctionedLoad) : null;
  return {
    targetCapacityKwp: num(d.targetCapacityKwp), roofType: d.roofType, roofAreaM2: num(d.roofAreaM2), systemType: d.systemType,
    supplyPhase: d.supplyPhase, sanctionedLoadKw: sanctionedKw, exportArrangement: d.exportArrangement, preferredModuleWp: d.preferredModuleWp,
    preferredModuleManufacturer: d.preferredModuleMfrId ? mfrNames[d.preferredModuleMfrId] ?? null : null,
    preferredInverterManufacturer: d.preferredInverterMfrId ? mfrNames[d.preferredInverterMfrId] ?? null : null,
    mountingMaterial: d.mountingMaterial, monitoring: d.monitoring as ProjectInputs["monitoring"],
    selectedModuleId: d.selectedModuleId, selectedInverterId: d.selectedInverterId, selectedStructureId: d.selectedStructureId,
    engineering: (d.engineering ?? {}) as ProjectInputs["engineering"],
    inputMeta: (d.inputMeta ?? {}) as ProjectInputs["inputMeta"],
  };
}

export async function runEngine(db: Db, projectId: string): Promise<{ result: EngineResult; skipped: string[] }> {
  const project = await db.project.findUniqueOrThrow({ where: { id: projectId }, include: projectInclude });
  const mfrs = await db.manufacturer.findMany({ select: { id: true, name: true } });
  const { catalogue, skipped } = await loadEngineCatalogue(db);
  const rules = await loadRules(db);
  const result = generateBom(toEngineInputs(project, Object.fromEntries(mfrs.map((m) => [m.id, m.name]))), catalogue, rules);
  if (project.designInputs?.sanctionedLoadUnit === "kVA") {
    result.outstanding.unshift("Sanctioned load is in kVA; compare with inverter capacity at the applicable power factor under current BESCOM rules.");
  }
  return { result, skipped };
}

/**
 * Run the engine and merge its lines into the project's BOM. Manual lines and
 * user overrides (procurement quantity, price, remarks) are preserved; every
 * quantity change is audited and a new revision snapshot is recorded.
 */
export async function generateAndSaveBom(db: PrismaClient, projectId: string, actor: Actor, summary: string) {
  const { result, skipped } = await runEngine(db, projectId);
  return db.$transaction(async (tx) => {
    let bom = await tx.bOMHeader.findFirst({ where: { projectId }, orderBy: { createdAt: "asc" } });
    if (!bom) bom = await tx.bOMHeader.create({ data: { projectId, title: "Preliminary BOM" } });
    const existing = await tx.bOMItem.findMany({ where: { bomId: bom.id } });
    const byRule = new Map(existing.filter((e) => !e.isManual && e.ruleKey).map((e) => [e.ruleKey!, e]));
    const priceList = await tx.priceList.findFirst({ where: { active: true }, include: { entries: { include: { supplier: true } } } });
    const products = await tx.product.findMany({ where: { id: { in: result.lines.map((l) => l.productId).filter(Boolean) as string[] } }, include: { taxClass: true } });
    const prodById = new Map(products.map((p) => [p.id, p]));
    const seen = new Set<string>();

    for (const [i, l] of result.lines.entries()) {
      seen.add(l.ruleKey);
      const prod = l.productId ? prodById.get(l.productId) : undefined;
      const priceEntry = l.productId ? priceList?.entries.find((e) => e.productId === l.productId) : undefined;
      const calc = dec(l.calculatedQty);
      const prior = byRule.get(l.ruleKey);
      if (!prior) {
        const created = await tx.bOMItem.create({
          data: {
            bomId: bom.id, section: l.section, lineNo: i + 1, itemCode: l.itemCode, name: l.name, specification: l.specification, unit: l.unit,
            calculatedQty: calc, procurementQty: calc, quantityStatus: l.quantityStatus, quantityBasis: l.quantityBasis, productId: l.productId ?? null,
            manufacturer: l.manufacturer, model: l.model, complianceReq: l.complianceReq, technicalNotes: l.technicalNotes, ruleKey: l.ruleKey,
            unitPrice: priceEntry ? priceEntry.unitPrice : null, priceProvenance: priceEntry ? priceEntry.provenance : null,
            supplierName: priceEntry?.supplier?.name ?? null,
            gstRatePercent: prod?.taxClass?.ratePercent ?? null, taxClassCode: prod?.taxClass?.code ?? null,
            availability: prod?.availability ?? "UNKNOWN",
          },
        });
        await audit(tx, actor, { entityType: "BOMItem", entityId: created.id, action: "create", field: "calculatedQty", newValue: l.calculatedQty, reason: summary });
        continue;
      }
      const oldCalc = num(prior.calculatedQty);
      const overridden = num(prior.procurementQty) !== oldCalc;
      const qtyChanged = oldCalc !== l.calculatedQty;
      const productChanged = prior.productId !== (l.productId ?? null);
      let status = l.quantityStatus;
      if (prior.quantityStatus === "ENGINEER_VERIFIED" && !qtyChanged && !productChanged) status = "ENGINEER_VERIFIED";
      await tx.bOMItem.update({
        where: { id: prior.id },
        data: {
          section: l.section, lineNo: i + 1, itemCode: l.itemCode, name: l.name, specification: l.specification, unit: l.unit,
          calculatedQty: calc, procurementQty: overridden && !prior.removed ? prior.procurementQty : calc, quantityStatus: status,
          quantityBasis: l.quantityBasis, productId: l.productId ?? null, manufacturer: l.manufacturer, model: l.model,
          complianceReq: l.complianceReq, technicalNotes: l.technicalNotes, removed: prior.removed,
          ...(productChanged ? { gstRatePercent: prod?.taxClass?.ratePercent ?? null, taxClassCode: prod?.taxClass?.code ?? null, unitPrice: priceEntry?.unitPrice ?? null, priceProvenance: priceEntry?.provenance ?? null } : {}),
        },
      });
      if (qtyChanged) await audit(tx, actor, { entityType: "BOMItem", entityId: prior.id, action: "recalculate", field: "calculatedQty", oldValue: oldCalc, newValue: l.calculatedQty, reason: summary });
      if (productChanged) await audit(tx, actor, { entityType: "BOMItem", entityId: prior.id, action: "recalculate", field: "productId", oldValue: prior.productId, newValue: l.productId, reason: summary });
      if (prior.quantityStatus === "ENGINEER_VERIFIED" && status !== "ENGINEER_VERIFIED") {
        await audit(tx, SYSTEM, { entityType: "BOMItem", entityId: prior.id, action: "verification-reset", field: "quantityStatus", oldValue: "ENGINEER_VERIFIED", newValue: status, reason: "Calculated quantity or product changed" });
      }
    }
    // Engine no longer produces these lines: flag rather than silently delete.
    for (const e of existing) {
      if (e.isManual || !e.ruleKey || seen.has(e.ruleKey) || e.removed) continue;
      await tx.bOMItem.update({ where: { id: e.id }, data: { removed: true } });
      await audit(tx, actor, { entityType: "BOMItem", entityId: e.id, action: "remove", reason: `No longer generated by the engine (${summary})` });
    }

    const snapshot = { ...result, skippedProducts: skipped } as unknown as Prisma.InputJsonValue;
    await tx.bOMHeader.update({ where: { id: bom.id }, data: { calcSnapshot: snapshot } });
    const rev = await createRevision(tx, bom.id, summary, actor);
    return { bomId: bom.id, revisionNo: rev.revisionNo, result };
  }, { timeout: 30000 });
}

export async function createRevision(db: Db, bomId: string, summary: string, actor: Actor) {
  const bom = await db.bOMHeader.findUniqueOrThrow({ where: { id: bomId }, include: { items: { orderBy: [{ lineNo: "asc" }] }, costItems: true } });
  const revisionNo = bom.currentRevision + 1;
  const rev = await db.bOMRevision.create({
    data: {
      bomId, revisionNo, summary, createdBy: actor.label, status: "DRAFT",
      snapshot: { items: bom.items, costItems: bom.costItems, calc: bom.calcSnapshot, pricesIncludeGst: bom.pricesIncludeGst } as unknown as Prisma.InputJsonValue,
    },
  });
  await db.bOMHeader.update({ where: { id: bomId }, data: { currentRevision: revisionNo, status: "DRAFT" } });
  await audit(db, actor, { entityType: "BOMRevision", entityId: rev.id, action: "create", newValue: `Rev ${revisionNo}`, reason: summary });
  return rev;
}

export async function duplicateProject(db: PrismaClient, sourceId: string, actor: Actor) {
  const src = await db.project.findUniqueOrThrow({ where: { id: sourceId }, include: projectInclude });
  const d = src.designInputs;
  const form: ProjectForm = {
    name: `${src.name} (copy)`, location: src.location, customerType: src.customerType, customerName: null, customerEmail: null, customerPhone: null,
    targetCapacityKwp: num(d?.targetCapacityKwp), roofType: d?.roofType ?? null, roofAreaM2: num(d?.roofAreaM2), isExpansion: d?.isExpansion ?? null,
    systemType: d?.systemType ?? null, supplyPhase: d?.supplyPhase ?? null, sanctionedLoad: num(d?.sanctionedLoad), sanctionedLoadUnit: (d?.sanctionedLoadUnit as "kW" | "kVA" | null) ?? null,
    exportArrangement: d?.exportArrangement ?? null, preferredModuleWp: d?.preferredModuleWp ?? null, preferredModuleMfrId: d?.preferredModuleMfrId ?? null,
    preferredInverterMfrId: d?.preferredInverterMfrId ?? null, mountingMaterial: d?.mountingMaterial ?? null, preferredConfiguration: d?.preferredConfiguration ?? null,
    budgetRange: d?.budgetRange ?? null, monitoring: (d?.monitoring as ProjectForm["monitoring"]) ?? null, selectedModuleId: d?.selectedModuleId ?? null,
    selectedInverterId: d?.selectedInverterId ?? null, selectedStructureId: d?.selectedStructureId ?? null,
    engineering: (d?.engineering ?? {}) as ProjectForm["engineering"], inputMeta: (d?.inputMeta ?? {}) as ProjectForm["inputMeta"],
  };
  return createProject(db, form, actor);
}
