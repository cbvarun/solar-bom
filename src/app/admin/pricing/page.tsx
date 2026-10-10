import { prisma } from "@/lib/db";
import { adminCtx, n } from "@/lib/server/admin-page";
import { PageHead, Field, Hidden, Check, Select, Area, ReadOnlyNote, opts } from "@/components/admin/Fields";
import { ActionForm, Submit } from "@/components/admin/ActionForm";
import { Badge, VerificationBadge } from "@/components/ui/Badge";
import { savePriceList, saveService, saveTaxClass } from "../actions";
import { formatDate, VERIFICATION_LABEL } from "@/lib/format";

const d = (v: Date | null | undefined) => (v ? v.toISOString().slice(0, 10) : "");

export default async function Pricing() {
  const { can } = await adminCtx();
  const [taxes, lists, services] = await Promise.all([
    prisma.taxClass.findMany({ include: { _count: { select: { products: true } } }, orderBy: { code: "asc" } }),
    prisma.priceList.findMany({ include: { _count: { select: { entries: true } } }, orderBy: { name: "asc" } }),
    prisma.installationService.findMany({ orderBy: { code: "asc" } }),
  ]);
  const tax = can("tax.edit"), price = can("pricing.edit");
  const taxForm = (t?: (typeof taxes)[number]) => (
    <ActionForm action={saveTaxClass} resetOnSuccess={!t}>
      <Hidden name="id" value={t?.id} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Code" name="code" defaultValue={t?.code} required />
        <Field label="Description" name="description" defaultValue={t?.description} required className="lg:col-span-2" />
        <Field label="HSN / SAC" name="hsnSac" defaultValue={t?.hsnSac} />
        <Field label="GST rate (%)" name="ratePercent" type="number" step="0.001" defaultValue={n(t?.ratePercent)} hint="Leave blank until confirmed" />
        <Select label="Status" name="verificationStatus" options={opts(VERIFICATION_LABEL)} defaultValue={t?.verificationStatus ?? "PENDING_VERIFICATION"} />
        <Field label="Source (notification no. / advice)" name="sourceNote" defaultValue={t?.sourceNote} className="lg:col-span-2" />
        <Field label="Source link" name="sourceUrl" defaultValue={t?.sourceUrl} placeholder="https://" className="lg:col-span-3" />
        <div className="flex items-end"><Submit variant={t ? "secondary" : "primary"}>{t ? "Save" : "Add tax class"}</Submit></div>
      </div>
    </ActionForm>
  );
  const listForm = (l?: (typeof lists)[number]) => (
    <ActionForm action={savePriceList} resetOnSuccess={!l}>
      <Hidden name="id" value={l?.id} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Name" name="name" defaultValue={l?.name} required />
        <Field label="Valid from" name="validFrom" type="date" defaultValue={d(l?.validFrom)} />
        <Field label="Valid to" name="validTo" type="date" defaultValue={d(l?.validTo)} />
        <Field label="Notes" name="notes" defaultValue={l?.notes} />
        <Check label="Prices include GST" name="pricesIncludeGst" defaultChecked={l?.pricesIncludeGst} />
        <Check label="Active" name="active" defaultChecked={l?.active ?? true} />
        <div className="sm:col-span-2 lg:col-span-2 lg:text-right"><Submit variant={l ? "secondary" : "primary"}>{l ? "Save" : "Add price list"}</Submit></div>
      </div>
    </ActionForm>
  );
  return (
    <>
      <PageHead title="Pricing & GST">GST rates, price lists and installation service rates. The application never assumes a GST rate: a line with an unconfigured rate shows “GST not configured” and the total is flagged incomplete.</PageHead>
      {!tax && !price && <ReadOnlyNote what="pricing and tax settings" />}

      <section>
        <h2 className="section-title">GST classes</h2>
        <p className="mt-1 text-xs text-ink-muted">Rates for solar goods and works contracts change through GST notifications and depend on how a supply is structured. Confirm each rate with your tax adviser and record the source.</p>
        <ul className="mt-3 space-y-2">
          {taxes.map((t) => (
            <li key={t.id} className="card p-3">
              <p className="mb-2 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                <span className="font-mono">{t.code}</span> · {t._count.products} product(s) · {t.ratePercent == null ? <Badge tone="yellow">rate not configured</Badge> : <Badge>{Number(t.ratePercent)}%</Badge>} <VerificationBadge status={t.verificationStatus} />
                {t.verifiedAt && <span>verified {formatDate(t.verifiedAt)}</span>}
              </p>
              {tax ? taxForm(t) : <p className="text-sm">{t.description}{t.sourceNote && ` · ${t.sourceNote}`}</p>}
            </li>
          ))}
        </ul>
        {tax && <details className="card mt-3 p-4"><summary className="cursor-pointer text-sm font-medium">Add tax class</summary><div className="mt-3">{taxForm()}</div></details>}
      </section>

      <section className="mt-8">
        <h2 className="section-title">Price lists</h2>
        <p className="mt-1 text-xs text-ink-muted">Supplier prices are recorded per product on each product page. Only active lists whose GST basis matches a BOM are used to fill its unpriced lines.</p>
        <ul className="mt-3 space-y-2">
          {lists.map((l) => (
            <li key={l.id} className="card p-3">
              <p className="mb-2 text-xs text-ink-muted">{l._count.entries} price(s) · {l.currency} {l.active ? <Badge tone="green">active</Badge> : <Badge>inactive</Badge>}</p>
              {price ? listForm(l) : <p className="text-sm">{l.name}</p>}
            </li>
          ))}
        </ul>
        {price && <details className="card mt-3 p-4"><summary className="cursor-pointer text-sm font-medium">Add price list</summary><div className="mt-3">{listForm()}</div></details>}
      </section>

      <section className="mt-8">
        <h2 className="section-title">Installation and project services</h2>
        <p className="mt-1 text-xs text-ink-muted">Blank rates appear in BOMs as “to be quoted”.</p>
        <div className="mt-3 overflow-x-auto rounded border border-slate-200">
          <table className="table-tech table-compact">
            <thead><tr><th>Code</th><th>Service</th><th>Basis</th><th>Rate (INR per unit)</th></tr></thead>
            <tbody>
              {services.map((s) => (
                <tr key={s.id}>
                  <td className="font-mono text-xs">{s.code}</td>
                  <td colSpan={price ? 3 : 1}>
                    {price ? (
                      <ActionForm action={saveService} className="grid gap-2 sm:grid-cols-[3fr_1fr_1.2fr_auto_auto] sm:items-end">
                        <Hidden name="id" value={s.id} />
                        <Field label="Name" name="name" defaultValue={s.name} required />
                        <p className="pb-2 text-xs text-ink-muted">{s.basis === "PER_KWP" ? "per kWp" : `per ${s.unit}`}</p>
                        <Field label="Rate" name="unitPrice" type="number" step="0.01" defaultValue={n(s.unitPrice)} placeholder="to be quoted" />
                        <div className="pb-2"><Check label="Active" name="active" defaultChecked={s.active} /></div>
                        <Submit variant="secondary">Save</Submit>
                      </ActionForm>
                    ) : s.name}
                  </td>
                  {!price && <><td className="text-xs">{s.basis}</td><td>{s.unitPrice == null ? "to be quoted" : Number(s.unitPrice)}</td></>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
