import { prisma } from "@/lib/db";
import { adminCtx } from "@/lib/server/admin-page";
import { PageHead, Field, Hidden, Check, Select, ReadOnlyNote } from "@/components/admin/Fields";
import { ActionForm, Submit } from "@/components/admin/ActionForm";
import { saveCategory } from "../actions";
import { BOM_SECTIONS } from "@/lib/engine";

export default async function Categories() {
  const { can } = await adminCtx();
  const rows = await prisma.productCategory.findMany({ include: { _count: { select: { products: true } } }, orderBy: { sortOrder: "asc" } });
  const edit = can("categories.edit");
  const sections = BOM_SECTIONS.map((s) => ({ value: s.key, label: s.label }));
  const form = (c?: (typeof rows)[number]) => (
    <ActionForm action={saveCategory} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.5fr_2fr_2fr_0.6fr_auto_auto] lg:items-end" resetOnSuccess={!c}>
      <Hidden name="id" value={c?.id} />
      <Field label="Slug" name="slug" defaultValue={c?.slug} required />
      <Field label="Name" name="name" defaultValue={c?.name} required />
      <Select label="Default BOM section" name="bomSection" options={sections} defaultValue={c?.bomSection} empty="—" />
      <Field label="Order" name="sortOrder" type="number" defaultValue={c?.sortOrder} />
      <div className="pb-2"><Check label="Archived" name="archived" defaultChecked={c?.archived} /></div>
      <Submit variant={c ? "secondary" : "primary"}>{c ? "Save" : "Add"}</Submit>
    </ActionForm>
  );
  return (
    <>
      <PageHead title="Categories">Catalogue categories and the BOM section their products fall into.</PageHead>
      {!edit && <ReadOnlyNote what="categories" />}
      {edit && <div className="card mb-4 p-4"><h2 className="mb-2 text-sm font-semibold">Add category</h2>{form()}</div>}
      <ul className="space-y-2">
        {rows.map((c) => (
          <li key={c.id} className="card p-3">
            <p className="mb-2 text-xs text-ink-muted">{c._count.products} product(s)</p>
            {edit ? form(c) : <p className="text-sm">{c.name} <code className="text-xs">{c.slug}</code></p>}
          </li>
        ))}
      </ul>
    </>
  );
}
