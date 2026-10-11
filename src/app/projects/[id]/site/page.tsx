import { prisma } from "@/lib/db";
import { loadProjectOr404 } from "@/lib/server/access";
import { energySummary, loadSite } from "@/lib/server/site";
import { SiteEditor } from "@/components/site/SiteEditor";
import { EnergyPanel } from "@/components/site/EnergyPanel";
import type { LatLon } from "@/components/site/SiteMap";

const n = (v: unknown) => (v == null ? null : Number(v));

export default async function SitePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { access } = await loadProjectOr404(id);
  const [site, energy, schemes] = await Promise.all([
    loadSite(prisma, id),
    energySummary(prisma, id),
    prisma.subsidyScheme.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  return (
    <div className="space-y-6">
      <SiteEditor
        projectId={id}
        readOnly={access !== "edit"}
        hasEstimate={!!site?.yieldEstimate}
        schemes={schemes.map((s) => ({ id: s.id, name: s.name, verified: s.verificationStatus === "VERIFIED" }))}
        initial={{
          latitude: n(site?.latitude), longitude: n(site?.longitude), roofOutline: (site?.roofOutline as LatLon[] | null) ?? [],
          tiltDeg: n(site?.tiltDeg), azimuthDeg: n(site?.azimuthDeg), systemLossPct: n(site?.systemLossPct), shadingLossPct: n(site?.shadingLossPct),
          tariffInrPerKwh: n(site?.tariffInrPerKwh), tariffSource: site?.tariffSource ?? null, subsidySchemeId: site?.subsidySchemeId ?? null,
        }}
      />
      <EnergyPanel e={energy} />
    </div>
  );
}
