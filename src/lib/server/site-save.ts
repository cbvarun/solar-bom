import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { polygonAreaM2 } from "@/lib/engine";
import type { SiteForm } from "@/lib/validation";
import { audit, type Actor } from "./audit";
import { generateAndSaveBom } from "./projects";
import { BomError } from "./bom";

const dec = (v: number | null | undefined) => (v == null ? null : new Prisma.Decimal(v));
const same = (a: unknown, b: unknown) => (a == null ? null : Number(a)) === (b == null ? null : Number(b));

/**
 * Save the site location, roof outline and savings inputs. Changing anything
 * the yield depends on clears the old estimate. Returns the row as written,
 * so callers never re-read it (a pooled read can return a cached older row).
 */
export async function saveSite(id: string, f: SiteForm, actor: Actor) {
    if (f.subsidySchemeId) {
      const s = await prisma.subsidyScheme.findUnique({ where: { id: f.subsidySchemeId } });
      if (!s?.active) throw new BomError("That subsidy scheme is not active.", 422);
    }
    const outline = f.roofOutline && f.roofOutline.length >= 3 ? f.roofOutline : null;
    const area = outline ? Math.round(polygonAreaM2(outline) * 100) / 100 : null;
    const before = await prisma.siteAssessment.findUnique({ where: { projectId: id } });
    const yieldInputsChanged = !before || !same(before.latitude, f.latitude) || !same(before.longitude, f.longitude) || !same(before.tiltDeg, f.tiltDeg)
      || !same(before.azimuthDeg, f.azimuthDeg) || !same(before.systemLossPct, f.systemLossPct) || !same(before.shadingLossPct, f.shadingLossPct);
    const data = {
      latitude: dec(f.latitude), longitude: dec(f.longitude), roofOutline: outline ?? Prisma.DbNull, roofOutlineAreaM2: dec(area),
      tiltDeg: dec(f.tiltDeg), azimuthDeg: dec(f.azimuthDeg), systemLossPct: dec(f.systemLossPct), shadingLossPct: dec(f.shadingLossPct),
      tariffInrPerKwh: dec(f.tariffInrPerKwh), tariffSource: f.tariffSource, subsidySchemeId: f.subsidySchemeId, updatedBy: actor.label,
      ...(yieldInputsChanged ? { yieldEstimate: Prisma.DbNull } : {}),
    };
    const site = await prisma.siteAssessment.upsert({ where: { projectId: id }, update: data, create: { projectId: id, ...data } });
    await audit(prisma, actor, { entityType: "SiteAssessment", entityId: site.id, action: before ? "update" : "create",
      newValue: { lat: f.latitude, lon: f.longitude, roofAreaM2: area, tilt: f.tiltDeg, azimuth: f.azimuthDeg, loss: f.systemLossPct, shading: f.shadingLossPct, tariff: f.tariffInrPerKwh, subsidy: f.subsidySchemeId } });
    let regenerated = false;
    if (f.applyRoofArea && area) {
      await prisma.projectDesignInputs.upsert({ where: { projectId: id }, update: { roofAreaM2: dec(area) }, create: { projectId: id, roofAreaM2: dec(area) } });
      await audit(prisma, actor, { entityType: "ProjectDesignInputs", entityId: id, action: "update", field: "roofAreaM2", newValue: area, reason: "Measured from roof outline on map (approximate)" });
      await generateAndSaveBom(prisma, id, actor, "Roof area updated from map outline");
      regenerated = true;
    }
    return { site, area, yieldCleared: yieldInputsChanged && !!before?.yieldEstimate, regenerated };
}
