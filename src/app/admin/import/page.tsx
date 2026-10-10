import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { adminCtx } from "@/lib/server/admin-page";
import { PageHead } from "@/components/admin/Fields";
import { ImportForm } from "@/components/admin/ImportForm";
import { IMPORT_COLUMNS } from "@/lib/server/import";

export default async function ImportPage() {
  const { can } = await adminCtx();
  if (!can("products.import")) redirect("/admin?denied=1");
  const [cats, taxes] = await Promise.all([prisma.productCategory.findMany({ orderBy: { sortOrder: "asc" } }), prisma.taxClass.findMany({ orderBy: { code: "asc" } })]);
  return (
    <>
      <PageHead title="Bulk import">Create or update products from a spreadsheet. Validate first: nothing is written unless every row passes. New products are created as drafts so they can be reviewed before they appear in the catalogue.</PageHead>
      <div className="grid gap-6 lg:grid-cols-[3fr_2fr] [&>*]:min-w-0">
        <ImportForm />
        <aside className="text-sm">
          <h2 className="font-semibold">File format</h2>
          <p className="mt-1"><a href="/api/admin/import-template">Download the CSV template</a>. The first row holds column names; matching SKUs are updated.</p>
          <p className="mt-2 break-all text-xs text-ink-muted">Columns: {IMPORT_COLUMNS.map((c) => <code key={c} className="mr-1">{c}</code>)}</p>
          <p className="mt-2 text-xs text-ink-muted">Specification columns: <code>spec:key[unit]</code>, for example <code>spec:pmax_w[W]</code>. Imported values are recorded with the row’s <code>provenance</code> and never as manufacturer-verified; verify each value against its datasheet in the product editor.</p>
          <p className="mt-2 break-words text-xs text-ink-muted [&_code]:break-all">Manufacturers must already exist (exact name). Category slugs: {cats.map((c) => <code key={c.id} className="mr-1">{c.slug}</code>)}</p>
          <p className="mt-2 break-all text-xs text-ink-muted">Tax class codes: {taxes.map((t) => <code key={t.id} className="mr-1">{t.code}</code>)}</p>
        </aside>
      </div>
    </>
  );
}
