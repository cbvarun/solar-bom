"use server";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/server/audit";
import { guarded, type ActionResult } from "@/lib/server/admin-guard";
import { PACKAGE_SECTIONS } from "@/lib/packages";

const s = (max = 300) => z.preprocess((v) => (v === "" || v == null ? null : String(v).trim()), z.string().max(max).nullable());
const int = z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().int().min(1).max(100000).nullable());

const schema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(2, "Name is required").max(120),
  capacityKwp: z.preprocess((v) => Number(v), z.number({ invalid_type_error: "Must be a number" }).positive("Must be above 0").max(10000)),
  supplyPhase: z.enum(["SINGLE", "THREE"]),
  moduleWp: int,
  moduleCount: int,
  notes: s(4000),
  active: z.preprocess((v) => v === "on", z.boolean()),
});

/**
 * Update a standard package and its lines. Lines are rewritten in order; a
 * row with an empty description is dropped. Changes do not affect projects
 * already created from the package.
 */
export async function savePackage(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return guarded("packages.edit", async (actor) => {
    const d = schema.parse(Object.fromEntries(fd.entries()));
    const rows = Number(fd.get("rows") ?? 0);
    const errors: Record<string, string> = {};
    const lines: { section: string; description: string; quantity: number; unit: string; makeScope: string | null; productId: string | null }[] = [];
    for (let i = 0; i < Math.min(rows, 60); i++) {
      const description = String(fd.get(`l${i}_description`) ?? "").trim();
      if (!description) continue;
      const quantity = Number(fd.get(`l${i}_quantity`));
      const section = String(fd.get(`l${i}_section`) ?? "");
      if (!(quantity > 0)) errors[`l${i}_quantity`] = "Enter a quantity above 0";
      if (!(PACKAGE_SECTIONS as readonly string[]).includes(section)) errors[`l${i}_section`] = "Choose a section";
      lines.push({
        section, description: description.slice(0, 500), quantity, unit: String(fd.get(`l${i}_unit`) ?? "").trim().slice(0, 20) || "no",
        makeScope: String(fd.get(`l${i}_makeScope`) ?? "").trim().slice(0, 300) || null, productId: String(fd.get(`l${i}_productId`) ?? "") || null,
      });
    }
    if (Object.keys(errors).length) return { ok: false, message: "Check the highlighted lines.", errors };
    if (!lines.length) return { ok: false, message: "A package needs at least one line." };
    const productIds = lines.map((l) => l.productId).filter((x): x is string => !!x);
    if (productIds.length && (await prisma.product.count({ where: { id: { in: productIds } } })) !== new Set(productIds).size) return { ok: false, message: "A linked catalogue item no longer exists." };

    const before = await prisma.standardPackage.findUniqueOrThrow({ where: { id: d.id }, include: { lines: { orderBy: { lineNo: "asc" } } } });
    await prisma.$transaction(async (tx) => {
      await tx.standardPackage.update({
        where: { id: d.id },
        data: { name: d.name, capacityKwp: new Prisma.Decimal(d.capacityKwp), supplyPhase: d.supplyPhase, moduleWp: d.moduleWp, moduleCount: d.moduleCount, notes: d.notes, active: d.active, updatedBy: actor.label },
      });
      await tx.standardPackageLine.deleteMany({ where: { packageId: d.id } });
      await tx.standardPackageLine.createMany({ data: lines.map((l, i) => ({ ...l, packageId: d.id, lineNo: i + 1, quantity: new Prisma.Decimal(l.quantity) })) });
      await audit(tx, actor, {
        entityType: "StandardPackage", entityId: d.id, action: "update",
        oldValue: { name: before.name, capacityKwp: Number(before.capacityKwp), active: before.active, lines: before.lines.map((l) => `${Number(l.quantity)} × ${l.description}`) },
        newValue: { name: d.name, capacityKwp: d.capacityKwp, active: d.active, lines: lines.map((l) => `${l.quantity} × ${l.description}`) },
      });
    });
    revalidatePath("/admin/packages");
    return { ok: true, message: "Package saved. Projects already created from it are unchanged." };
  });
}
