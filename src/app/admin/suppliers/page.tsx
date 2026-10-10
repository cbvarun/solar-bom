import { prisma } from "@/lib/db";
import { adminCtx } from "@/lib/server/admin-page";
import { PageHead, Field, Hidden, Check, ReadOnlyNote } from "@/components/admin/Fields";
import { ActionForm, Submit } from "@/components/admin/ActionForm";
import { Badge } from "@/components/ui/Badge";
import { saveSupplier } from "../actions";

export default async function Suppliers() {
  const { can } = await adminCtx();
  const rows = await prisma.supplier.findMany({ include: { _count: { select: { prices: true } } }, orderBy: { name: "asc" } });
  const edit = can("suppliers.edit");
  const form = (s?: (typeof rows)[number]) => (
    <ActionForm action={saveSupplier} resetOnSuccess={!s}>
      <Hidden name="id" value={s?.id} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Name" name="name" defaultValue={s?.name} required />
        <Field label="Contact person" name="contactName" defaultValue={s?.contactName} />
        <Field label="Email" name="email" type="email" defaultValue={s?.email} />
        <Field label="Phone" name="phone" defaultValue={s?.phone} />
        <Field label="City" name="city" defaultValue={s?.city} />
        <Field label="GSTIN" name="gstin" defaultValue={s?.gstin} maxLength={15} />
        <Field label="Notes" name="notes" defaultValue={s?.notes} />
        <div className="flex items-end justify-between gap-2 pb-1"><Check label="Archived" name="archived" defaultChecked={s?.archived} /><Submit variant={s ? "secondary" : "primary"}>{s ? "Save" : "Add"}</Submit></div>
      </div>
    </ActionForm>
  );
  return (
    <>
      <PageHead title="Suppliers">Suppliers whose quotations back the prices in the catalogue.</PageHead>
      {!edit && <ReadOnlyNote what="suppliers" />}
      {edit && <div className="card mb-4 p-4"><h2 className="mb-2 text-sm font-semibold">Add supplier</h2>{form()}</div>}
      <ul className="space-y-2">
        {rows.map((s) => (
          <li key={s.id} className="card p-3">
            <p className="mb-2 text-xs text-ink-muted">{s._count.prices} price(s) on file {s.illustrative && <Badge tone="yellow">illustrative</Badge>} {s.archived && <Badge>archived</Badge>}</p>
            {edit ? form(s) : <p className="text-sm">{s.name} · {s.city ?? "—"} · {s.email ?? "—"}</p>}
          </li>
        ))}
      </ul>
    </>
  );
}
