import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getActor, projectAccess } from "@/lib/auth";
import { combinedLossPct } from "@/lib/engine";
import { audit } from "@/lib/server/audit";
import { fetchPvgisYield, YieldServiceError } from "@/lib/server/site";
import { handleError, notFound } from "@/lib/server/api";
import { saveSite } from "@/lib/server/site-save";
import { siteSchema } from "@/lib/validation";

/**
 * Run the PVGIS yield estimate and store it with its source. When the form
 * is sent along, it is saved first and the estimate uses the row as written,
 * not a fresh read that a pooled connection may serve from cache.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project || (await projectAccess(project)) !== "edit") return notFound();
  const raw = await req.text();
  let site;
  try {
    site = raw ? (await saveSite(id, siteSchema.parse(JSON.parse(raw)), await getActor())).site : await prisma.siteAssessment.findUnique({ where: { projectId: id } });
  } catch (e) {
    return handleError(e);
  }
  if (site?.latitude == null || site.longitude == null) return NextResponse.json({ error: "Save the site location on the map first." }, { status: 422 });
  if (site.systemLossPct == null) return NextResponse.json({ error: "Enter the system losses (%) before estimating." }, { status: 422 });
  const prev = site.yieldEstimate as { fetchedAt?: string } | null;
  if (prev?.fetchedAt && Date.now() - Date.parse(prev.fetchedAt) < 15_000) return NextResponse.json({ error: "An estimate was just made. Wait a few seconds before trying again." }, { status: 429 });
  try {
    const est = await fetchPvgisYield({
      latitude: Number(site.latitude), longitude: Number(site.longitude),
      tiltDeg: site.tiltDeg == null ? null : Number(site.tiltDeg), azimuthDeg: site.azimuthDeg == null ? null : Number(site.azimuthDeg),
      lossPct: combinedLossPct(Number(site.systemLossPct), site.shadingLossPct == null ? null : Number(site.shadingLossPct)),
    });
    await prisma.siteAssessment.update({ where: { id: site.id }, data: { yieldEstimate: est as unknown as Prisma.InputJsonValue } });
    await audit(prisma, await getActor(), { entityType: "SiteAssessment", entityId: site.id, action: "yield-estimate", newValue: `${est.specificYieldKwhPerKwpYr} kWh/kWp/yr (${est.source})` });
    return NextResponse.json(est);
  } catch (e) {
    if (e instanceof YieldServiceError) return NextResponse.json({ error: e.message }, { status: 502 });
    console.error(e);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
