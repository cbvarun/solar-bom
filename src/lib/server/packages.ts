import "server-only";
import type { PrismaClient } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { audit, type Actor } from "./audit";
import { createRevision, initComplianceChecklist, nextReference } from "./projects";

export interface PackageProjectForm {
  name: string;
  location: string | null;
  customerType: "RESIDENTIAL" | "APARTMENT" | "COMMERCIAL" | "INDUSTRIAL" | null;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  /** Enquiry this project answers; linked when it has no project yet. */
  enquiryId?: string | null;
}

/**
 * Start a project from a standard package. The BOM gets the package lines as
 * entered (quantities "estimated" until engineering verifies them) and is
 * never recalculated by the engine, which would add a second set of lines.
 */
export async function createProjectFromPackage(db: PrismaClient, packageId: string, f: PackageProjectForm, actor: Actor) {
  const pkg = await db.standardPackage.findUniqueOrThrow({ where: { id: packageId }, include: { lines: { orderBy: { lineNo: "asc" }, include: { product: { include: { taxClass: true } } } } } });
  // Same price rule as calculated BOMs: active list without GST, unexpired supplier entries, lowest wins.
  const now = new Date();
  const productIds = pkg.lines.map((l) => l.productId).filter((x): x is string => !!x);
  const prices = await db.priceListEntry.findMany({
    where: { productId: { in: productIds }, priceList: { active: true, pricesIncludeGst: false }, OR: [{ validTo: null }, { validTo: { gte: now } }] },
    include: { supplier: true }, orderBy: { unitPrice: "asc" },
  });
  return db.$transaction(async (tx) => {
    const p = await tx.project.create({
      data: {
        reference: await nextReference(tx), name: f.name, location: f.location, customerType: f.customerType,
        customerName: f.customerName, customerEmail: f.customerEmail, customerPhone: f.customerPhone,
        ownerToken: randomBytes(18).toString("base64url"), createdById: actor.userId,
        designInputs: { create: { targetCapacityKwp: pkg.capacityKwp, supplyPhase: pkg.supplyPhase, systemType: pkg.systemType, preferredModuleWp: pkg.moduleWp } },
        boms: { create: { title: `Preliminary BOM (${pkg.name})`, sourcePackageId: pkg.id } },
      },
      include: { boms: true },
    });
    const bom = p.boms[0];
    const priceFor = (productId: string | null) => {
      const e = productId ? prices.find((x) => x.productId === productId) : undefined;
      return e ? { unitPrice: e.unitPrice, priceProvenance: e.provenance, supplierName: e.supplier?.name ?? null } : {};
    };
    for (const l of pkg.lines) {
      await tx.bOMItem.create({
        data: {
          bomId: bom.id, section: l.section, lineNo: l.lineNo, itemCode: l.product?.sku ?? `PKG-${l.lineNo}`, name: l.description, unit: l.unit,
          calculatedQty: null, procurementQty: l.quantity, quantityStatus: "ESTIMATED", quantityBasis: `Standard package ${pkg.name}`,
          productId: l.productId, technicalNotes: l.makeScope ? `Make / scope in package: ${l.makeScope}` : null, isManual: true,
          ...priceFor(l.productId),
          gstRatePercent: l.product?.taxClass?.ratePercent ?? null, taxClassCode: l.product?.taxClass?.code ?? null,
        },
      });
    }
    await audit(tx, actor, { entityType: "Project", entityId: p.id, action: "create", newValue: f.name, reason: `From standard package ${pkg.code}` });
    if (f.enquiryId) {
      const linked = await tx.enquiry.updateMany({ where: { id: f.enquiryId, projectId: null }, data: { projectId: p.id } });
      if (linked.count) await audit(tx, actor, { entityType: "Enquiry", entityId: f.enquiryId, action: "update", field: "projectId", newValue: p.reference, reason: `Project created from standard package ${pkg.code}` });
    }
    await initComplianceChecklist(tx, p.id, null);
    await createRevision(tx, bom.id, `Created from standard package ${pkg.name}`, actor);
    return p;
  }, { timeout: 30000 });
}
