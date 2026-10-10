import { prisma } from "@/lib/db";
import { adminCtx } from "@/lib/server/admin-page";
import { PageHead, Field, Hidden, Check, ReadOnlyNote } from "@/components/admin/Fields";
import { ActionForm, Submit } from "@/components/admin/ActionForm";
import { Badge } from "@/components/ui/Badge";
import { saveManufacturer } from "../actions";

export default async function Manufacturers() {
  const { can } = await adminCtx();
  const rows = await prisma.manufacturer.findMany({ include: { _count: { select: { products: true } } }, orderBy: { name: "asc" } });
  const edit = can("manufacturers.edit");
  const form = (m?: (typeof rows)[number]) => (
    <ActionForm action={saveManufacturer} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_2fr_1fr_2fr_auto_auto] lg:items-end" resetOnSuccess={!m}>
      <Hidden name="id" value={m?.id} />
      <Field label="Name" name="name" defaultValue={m?.name} required />
      <Field label="Website" name="website" defaultValue={m?.website} placeholder="https://" />
      <Field label="Country" name="country" defaultValue={m?.country} />
      <Field label="Notes" name="notes" defaultValue={m?.notes} />
      <div className="pb-2"><Check label="Archived" name="archived" defaultChecked={m?.archived} /></div>
      <Submit variant={m ? "secondary" : "primary"}>{m ? "Save" : "Add"}</Submit>
    </ActionForm>
  );
  return (
    <>
      <PageHead title="Manufacturers">Records marked “illustrative” are placeholders for the demo catalogue, not real companies.</PageHead>
      {!edit && <ReadOnlyNote what="manufacturers" />}
      {edit && <div className="card mb-4 p-4"><h2 className="mb-2 text-sm font-semibold">Add manufacturer</h2>{form()}</div>}
      <ul className="space-y-2">
        {rows.map((m) => (
          <li key={m.id} className="card p-3">
            <p className="mb-2 text-xs text-ink-muted">{m._count.products} product(s) {m.illustrative && <Badge tone="yellow">illustrative</Badge>} {m.archived && <Badge>archived</Badge>}</p>
            {edit ? form(m) : <p className="text-sm">{m.name} {m.website && <a href={m.website} rel="noopener noreferrer" target="_blank">{m.website}</a>}</p>}
          </li>
        ))}
      </ul>
    </>
  );
}
