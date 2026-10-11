import Link from "next/link";
import { prisma } from "@/lib/db";
import { adminCtx, n } from "@/lib/server/admin-page";
import { PageHead, Field, Area, Hidden, Check, Select, ReadOnlyNote } from "@/components/admin/Fields";
import { ActionForm, Submit } from "@/components/admin/ActionForm";
import { Badge } from "@/components/ui/Badge";
import { NewFromPackage } from "@/components/packages/NewFromPackage";
import { savePackage } from "../package-actions";
import { PACKAGE_EXTRA_ROWS, PACKAGE_SECTIONS } from "@/lib/packages";
import { sectionLabel } from "@/lib/engine";
import { formatDateTime, PHASE_LABEL } from "@/lib/format";

const loadPackages = () => prisma.standardPackage.findMany({
  orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  include: { lines: { orderBy: { lineNo: "asc" }, include: { product: { select: { id: true, sku: true } } } }, _count: { select: { boms: true } } },
});
type Pkg = Awaited<ReturnType<typeof loadPackages>>[number];
type ProductOpt = { value: string; label: string };

function PackageForm({ p, products }: { p: Pkg; products: ProductOpt[] }) {
  const rows = [...p.lines, ...Array.from({ length: PACKAGE_EXTRA_ROWS }, () => null)];
  const sections = PACKAGE_SECTIONS.map((s) => ({ value: s, label: sectionLabel(s) }));
  return (
    <ActionForm action={savePackage} className="grid gap-3 sm:grid-cols-2">
      <Hidden name="id" value={p.id} />
      <Hidden name="rows" value={String(rows.length)} />
      <Field label="Name" name="name" required defaultValue={p.name} />
      <Select label="Supply" name="supplyPhase" defaultValue={p.supplyPhase} options={[{ value: "SINGLE", label: "Single-phase" }, { value: "THREE", label: "Three-phase" }]} />
      <Field label="DC capacity (kWp)" name="capacityKwp" type="number" step="any" required defaultValue={n(p.capacityKwp)} />
      <div className="grid grid-cols-2 gap-2">
        <Field label="Module rating (Wp)" name="moduleWp" type="number" defaultValue={p.moduleWp} />
        <Field label="Module count" name="moduleCount" type="number" defaultValue={p.moduleCount} />
      </div>
      <Area label="Notes" name="notes" defaultValue={p.notes} className="sm:col-span-2" />
      <fieldset className="min-w-0 sm:col-span-2">
        <legend className="label">Lines</legend>
        <p className="hint">Clear a description to remove its line. The blank rows at the end add new lines.</p>
        <div className="mt-2 space-y-3">
          {rows.map((l, i) => (
            <div key={l?.id ?? `new${i}`} className="grid gap-2 rounded border border-slate-200 p-2 sm:grid-cols-[2fr_1fr_5rem_4rem]">
              <Field label={`Line ${i + 1}: description`} name={`l${i}_description`} defaultValue={l?.description} />
              <Select label="Section" name={`l${i}_section`} options={sections} defaultValue={l?.section ?? "DC_WIRING"} />
              <Field label="Qty" name={`l${i}_quantity`} type="number" step="any" defaultValue={l ? n(l.quantity) : null} />
              <Field label="Unit" name={`l${i}_unit`} defaultValue={l?.unit ?? "no"} />
              <Field label="Make / scope" name={`l${i}_makeScope`} defaultValue={l?.makeScope} className="sm:col-span-2" />
              <Select label="Catalogue item" name={`l${i}_productId`} options={products} defaultValue={l?.productId ?? ""} empty="None" className="sm:col-span-2" />
            </div>
          ))}
        </div>
      </fieldset>
      <div className="flex items-end"><Check label="Active (offered for new projects)" name="active" defaultChecked={p.active} /></div>
      <div className="text-right"><Submit>Save package</Submit></div>
    </ActionForm>
  );
}

export default async function Packages() {
  const { can } = await adminCtx();
  const [packages, products] = await Promise.all([
    loadPackages(),
    prisma.product.findMany({ where: { status: "ACTIVE" }, select: { id: true, sku: true, name: true }, orderBy: { sku: "asc" } }),
  ]);
  const edit = can("packages.edit"), use = can("packages.use");
  const productOpts = products.map((p) => ({ value: p.id, label: `${p.sku} · ${p.name}` }));
  return (
    <>
      <PageHead title="Standard packages">
        Fixed kits quoted by size and phase. A project started from a package gets these lines as its BOM, marked estimated until engineering verifies them, and the calculation engine does not recalculate it. Lines are stored as written in the source document; they are not manufacturer-verified specifications.
      </PageHead>
      {!edit && <ReadOnlyNote what="standard packages" />}
      <ul className="space-y-4">
        {packages.map((p) => (
          <li key={p.id} className="card min-w-0 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">{p.name}</p>
              <Badge tone={p.active ? "green" : "gray"}>{p.active ? "active" : "inactive"}</Badge>
              <span className="text-xs text-ink-muted">{n(p.capacityKwp)} kWp · {PHASE_LABEL[p.supplyPhase]}{p.moduleCount && p.moduleWp ? ` · ${p.moduleCount} × ${p.moduleWp} Wp` : ""} · {p._count.boms} project{p._count.boms === 1 ? "" : "s"}</span>
            </div>
            <p className="mt-1 text-xs text-ink-muted">{p.code} · Source: {p.source}{p.updatedBy && ` · last edited by ${p.updatedBy}, ${formatDateTime(p.updatedAt)}`}</p>
            {p.notes && <p className="mt-2 text-sm text-ink-muted">{p.notes}</p>}
            <div className="mt-3 overflow-x-auto">
              <table className="table-tech table-compact">
                <thead><tr><th>#</th><th>Item (as written)</th><th className="num">Qty</th><th>Unit</th><th>Make / scope</th><th>Catalogue</th></tr></thead>
                <tbody>{p.lines.map((l) => (
                  <tr key={l.id}><td>{l.lineNo}</td><td>{l.description}<span className="block text-xs text-ink-muted">{sectionLabel(l.section)}</span></td><td className="num">{n(l.quantity)}</td><td>{l.unit}</td><td className="text-xs">{l.makeScope ?? "—"}</td>
                    <td className="text-xs">{l.product ? <Link href={`/admin/products/${l.product.id}`}>{l.product.sku}</Link> : "—"}</td></tr>
                ))}</tbody>
              </table>
            </div>
            {use && p.active && <details className="mt-3"><summary className="cursor-pointer text-sm">New project from this package</summary><div className="mt-3"><NewFromPackage packageId={p.id} packageName={p.name} /></div></details>}
            {edit && <details className="mt-3"><summary className="cursor-pointer text-sm">Edit</summary><div className="mt-3"><PackageForm p={p} products={productOpts} /></div></details>}
          </li>
        ))}
        {packages.length === 0 && <li className="text-sm text-ink-muted">No standard packages yet.</li>}
      </ul>
    </>
  );
}
