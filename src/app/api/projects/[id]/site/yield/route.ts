import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getActor, projectAccess } from "@/lib/auth";
import { combinedLossPct } from "@/lib/engine";
import { audit } from "@/lib/server/audit";
import { fetchPvgisYield, YieldServiceError } from "@/lib/server/site";
import { notFound } from "@/lib/server/api";

/** Run the PVGIS yield estimate for the saved site and store it with its source. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project || (await projectAccess(project)) !== "edit") return notFound();
  const site = await prisma.siteAssessment.findUnique({ where: { projectId: id } });
  if (site?.latitude == null || site.longitude == null) return NextResponse.json({ error: "Save the site location on the map first." }, { status: 422 });
  if (site.systemLossPct == null) return NextResponse.json({ error: "Enter the system losses (%) and save before estimating." }, { status: 422 });
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
