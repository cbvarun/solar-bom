import { prisma } from "@/lib/db";
import { PackageBomNotice } from "@/components/packages/PackageBomNotice";
import { loadProjectOr404 } from "@/lib/server/access";
import { bomPricing, engineSnapshot, loadBom } from "@/lib/server/bom";
import { serializeItems } from "@/lib/server/serialize";
import { getSession, hasRole } from "@/lib/auth";
import { BomEditor } from "@/components/bom/BomEditor";
import { PreliminaryNotice } from "@/components/ui/Alert";

export default async function BomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { access } = await loadProjectOr404(id);
  const bom = await loadBom(prisma, id);
  if (!bom) return <p>No BOM yet.</p>;
  const session = await getSession();
  const products = await prisma.product.findMany({ where: { status: "ACTIVE" }, include: { category: true, manufacturer: true }, orderBy: [{ category: { sortOrder: "asc" } }, { sku: "asc" }] });
  const calc = engineSnapshot(bom);
  const pkg = bom.sourcePackageId ? await prisma.standardPackage.findUnique({ where: { id: bom.sourcePackageId } }) : null;
  return (
    <div className="space-y-4">
      <PreliminaryNotice />
      {pkg && <PackageBomNotice pkg={pkg} />}
      <BomEditor
        projectId={id}
        readOnly={access !== "edit"}
        items={serializeItems(bom)}
        pricing={bomPricing(bom)}
        header={{ status: bom.status, revision: bom.currentRevision, pricesIncludeGst: bom.pricesIncludeGst }}
        costItems={bom.costItems.map((c) => ({ label: c.label, amount: c.amount == null ? null : Number(c.amount), gstRatePercent: c.gstRatePercent == null ? null : Number(c.gstRatePercent), notes: c.notes }))}
        checks={calc?.checks ?? []}
        products={products.map((p) => ({ id: p.id, sku: p.sku, name: p.name, category: p.category.name, categorySlug: p.category.slug, section: p.category.bomSection ?? "CABLE_MGMT", manufacturer: p.manufacturer.name, unit: p.unit }))}
        permissions={{ verify: hasRole(session, "DESIGN_ENGINEER"), price: hasRole(session, "PROCUREMENT", "SALES_ENGINEER"), staff: !!session }}
      />
    </div>
  );
}
