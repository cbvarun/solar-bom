"use server";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/server/audit";
import { guarded, type ActionResult } from "@/lib/server/admin-guard";

const s = (max = 300) => z.preprocess((v) => (v === "" || v == null ? null : String(v).trim()), z.string().max(max).nullable());
const n = (min: number, max: number) => z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number({ invalid_type_error: "Must be a number" }).min(min).max(max).nullable());
const CUSTOMER_TYPES = ["RESIDENTIAL", "APARTMENT", "COMMERCIAL", "INDUSTRIAL"] as const;
import { SLAB_ROWS } from "@/lib/subsidy";

const schema = z.object({
  id: s(64),
  code: z.string().trim().min(2, "Code is required").max(40).regex(/^[A-Z0-9_]+$/, "Capital letters, digits and underscore"),
  name: z.string().trim().min(3, "Name is required").max(200),
  maxCapacityKw: n(0, 100000),
  maxAmountInr: n(0, 1e10),
  sourceUrl: s(500).refine((v) => v == null || /^https:\/\//.test(v), "Use an https link to the official source"),
  notes: s(2000),
  verificationStatus: z.enum(["PENDING_VERIFICATION", "UNDER_ENGINEERING_REVIEW", "VERIFIED"]),
  active: z.preprocess((v) => v === "on", z.boolean()),
});

/**
 * Create or update a subsidy scheme. Amounts are typed in from the official
 * notification; a scheme can be marked verified only with its source link.
 */
export async function saveSubsidyScheme(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return guarded("subsidies.edit", async (actor) => {
    const d = schema.parse(Object.fromEntries(fd.entries()));
    const customerTypes = fd.getAll("customerTypes").map(String).filter((t): t is (typeof CUSTOMER_TYPES)[number] => (CUSTOMER_TYPES as readonly string[]).includes(t));
    const slabs: { upToKw: number; inrPerKw: number }[] = [];
    const errors: Record<string, string> = {};
    for (let i = 0; i < SLAB_ROWS; i++) {
      const up = String(fd.get(`slab${i}_upToKw`) ?? "").trim();
      const rate = String(fd.get(`slab${i}_inrPerKw`) ?? "").trim();
      if (!up && !rate) continue;
      const u = Number(up), r = Number(rate);
      if (!up || !rate || !(u > 0) || !(r >= 0)) { errors[`slab${i}_upToKw`] = "Enter both a capacity limit above 0 and an amount per kW"; continue; }
      if (slabs.length && u <= slabs[slabs.length - 1].upToKw) { errors[`slab${i}_upToKw`] = "Each slab's limit must be higher than the previous one"; continue; }
      slabs.push({ upToKw: u, inrPerKw: r });
    }
    if (Object.keys(errors).length) return { ok: false, message: "Check the capacity slabs.", errors };
    if (!customerTypes.length) return { ok: false, message: "Choose at least one customer type.", errors: { customerTypes: "Required" } };
    if (d.verificationStatus === "VERIFIED" && !d.sourceUrl) return { ok: false, message: "Add the official source link before marking the amounts verified.", errors: { sourceUrl: "Required to verify" } };
    if (d.active && !slabs.length) return { ok: false, message: "Enter at least one slab before activating the scheme.", errors: { slab0_upToKw: "Required to activate" } };

    const data = {
      code: d.code, name: d.name, customerTypes, slabs: slabs as unknown as Prisma.InputJsonValue,
      maxCapacityKw: d.maxCapacityKw == null ? null : new Prisma.Decimal(d.maxCapacityKw), maxAmountInr: d.maxAmountInr == null ? null : new Prisma.Decimal(d.maxAmountInr),
      sourceUrl: d.sourceUrl, notes: d.notes, verificationStatus: d.verificationStatus, active: d.active,
    };
    if (d.id) {
      const before = await prisma.subsidyScheme.findUniqueOrThrow({ where: { id: d.id } });
      const becameVerified = d.verificationStatus === "VERIFIED" && before.verificationStatus !== "VERIFIED";
      const amountsChanged = JSON.stringify(before.slabs) !== JSON.stringify(slabs) || Number(before.maxAmountInr ?? -1) !== (d.maxAmountInr ?? -1) || Number(before.maxCapacityKw ?? -1) !== (d.maxCapacityKw ?? -1);
      // Changing amounts on a verified scheme sends it back for verification.
      const status = amountsChanged && before.verificationStatus === "VERIFIED" && !becameVerified ? "PENDING_VERIFICATION" : d.verificationStatus;
      await prisma.subsidyScheme.update({ where: { id: d.id }, data: { ...data, verificationStatus: status, ...(becameVerified ? { verifiedAt: new Date(), verifiedBy: actor.label } : status !== "VERIFIED" ? { verifiedAt: null, verifiedBy: null } : {}) } });
      await audit(prisma, actor, { entityType: "SubsidyScheme", entityId: d.id, action: "update", oldValue: { slabs: before.slabs, maxAmountInr: before.maxAmountInr == null ? null : Number(before.maxAmountInr), active: before.active, status: before.verificationStatus }, newValue: { slabs, maxAmountInr: d.maxAmountInr, active: d.active, status } });
    } else {
      const c = await prisma.subsidyScheme.create({ data: { ...data, ...(d.verificationStatus === "VERIFIED" ? { verifiedAt: new Date(), verifiedBy: actor.label } : {}) } });
      await audit(prisma, actor, { entityType: "SubsidyScheme", entityId: c.id, action: "create", newValue: { code: d.code, slabs, active: d.active } });
    }
    revalidatePath("/admin/subsidies");
    return { ok: true, message: "Subsidy scheme saved." };
  });
}
