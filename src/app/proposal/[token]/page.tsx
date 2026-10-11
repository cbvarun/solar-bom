import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isExpired, loadSharedQuotation } from "@/lib/server/proposal";
import { STANDARD_EXCLUSIONS, STANDARD_TERMS, type QuotationSnapshot } from "@/lib/exports/payload";
import { sectionLabel } from "@/lib/engine";
import { EnergyPanel } from "@/components/site/EnergyPanel";
import { AcceptForm } from "@/components/proposal/AcceptForm";
import { ProposalPdfButton } from "@/components/proposal/ProposalPdfButton";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { formatDate, formatDateTime, formatINR, QUANTITY_STATUS_LABEL } from "@/lib/format";

// The link is the credential: keep it out of search engines and referrers.
export const metadata: Metadata = { title: "Your solar proposal", robots: { index: false, follow: false }, referrer: "no-referrer" };
export const dynamic = "force-dynamic";

const qty = (v: number | null) => (v == null ? "TBC" : v.toLocaleString("en-IN", { maximumFractionDigits: 3 }));

export default async function ProposalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const q = await loadSharedQuotation(token);
  if (!q) notFound();
  const snap = q.snapshot as unknown as QuotationSnapshot;
  const d = snap.payload;
  const s = d.calc?.summary;
  const expired = isExpired(q);
  // Skip company placeholders ("Phone not configured") rather than print them as contact details.
  const contact = [d.company.phone, d.company.email].filter((v) => v && !/not configured/i.test(v)).join(" or ");
  const sections = [...new Set(d.items.map((i) => i.section))];
  return (
    <div className="container-page space-y-6 py-6">
      <header className="card p-5">
        <p className="text-sm text-ink-muted">{d.company.name}</p>
        <h1 className="mt-1 text-2xl font-semibold">Solar proposal{d.project.customerName ? ` for ${d.project.customerName}` : ""}</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {snap.quotationNumber} · {d.project.name}{d.project.location ? ` · ${d.project.location}` : ""} · prepared {formatDate(d.generatedAt)}
          {q.validUntil && <> · valid until {formatDate(q.validUntil)}</>}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {q.acceptedAt ? <Badge tone="green">Accepted {formatDate(q.acceptedAt)}</Badge> : expired ? <Badge tone="red">Expired</Badge> : <Badge tone="blue">Awaiting your decision</Badge>}
          <ProposalPdfButton token={token} />
        </div>
      </header>

      <Alert tone="warning">
        This is a preliminary proposal. Quantities and prices are confirmed after a site survey and engineering design. It does not mean BESCOM or any authority has approved the system, and choosing certified equipment does not by itself make the installation compliant.
      </Alert>

      <section className="card p-5">
        <h2 className="section-title">Your system</h2>
        <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-[max-content_1fr]">
          <dt className="text-ink-muted">Capacity</dt><dd>{s?.installedDcW != null ? `${s.installedDcW / 1000} kWp (${s.moduleCount} × ${s.moduleWp} Wp modules)` : "To be confirmed"}</dd>
          <dt className="text-ink-muted">Inverter</dt><dd>{s?.selectedInverter ? `${s.selectedInverter}, ${s.inverterAcW! / 1000} kW AC` : "To be confirmed"}</dd>
          {d.design.map(([k, v]) => <div key={k} className="contents"><dt className="text-ink-muted">{k}</dt><dd>{v}</dd></div>)}
        </dl>
        {d.majors.length > 0 && (
          <ul className="mt-4 space-y-1 text-sm">
            {d.majors.map((m) => <li key={m.sku}><span className="font-medium">{m.name}</span>{m.illustrative && <span className="text-xs text-ink-muted"> (illustrative catalogue entry, final make confirmed at order)</span>}</li>)}
          </ul>
        )}
      </section>

      {d.energy ? <EnergyPanel e={d.energy} compact /> : <p className="text-sm text-ink-muted">Generation and savings estimates were not included in this quotation.</p>}

      <section className="card p-5">
        <h2 className="section-title">Price</h2>
        <dl className="mt-3 grid max-w-md grid-cols-[1fr_auto] gap-y-1 text-sm">
          <dt className="text-ink-muted">Subtotal (excl. GST)</dt><dd className="num">{formatINR(d.pricing.subtotalExGst)}</dd>
          <dt className="text-ink-muted">GST</dt><dd className="num">{formatINR(d.pricing.gstTotal)}</dd>
          <dt className="font-semibold">Total (incl. GST)</dt><dd className="num font-semibold">{formatINR(d.pricing.grandTotal)}</dd>
        </dl>
        {!d.pricing.complete && <Alert tone="warning" className="mt-3">Pricing is incomplete: {d.pricing.unpricedLines} line(s) are not yet priced. The total covers priced lines only; our team will confirm the full price.</Alert>}
      </section>

      <section className="card p-5">
        <h2 className="section-title">What's included</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="table-tech table-compact">
            <thead><tr><th>Item</th><th className="num">Qty</th><th>Unit</th><th>Status</th></tr></thead>
            {sections.map((sec) => (
              <tbody key={sec}>
                <tr><th colSpan={4} className="bg-brand-50 text-left">{sectionLabel(sec)}</th></tr>
                {d.items.filter((i) => i.section === sec).map((i) => (
                  <tr key={i.id}><td>{i.name}{i.specification && <span className="block text-xs text-ink-muted">{i.specification}</span>}</td><td className="num">{qty(i.procurementQty)}</td><td>{i.unit}</td><td className="text-xs">{QUANTITY_STATUS_LABEL[i.quantityStatus]}</td></tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="section-title">Exclusions and terms</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{STANDARD_EXCLUSIONS.map((e) => <li key={e}>{e}</li>)}</ul>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm">{STANDARD_TERMS.map((t) => <li key={t}>{t}</li>)}</ol>
      </section>

      <section className="card p-5" id="accept">
        <h2 className="section-title">Accept this proposal</h2>
        {q.acceptedAt ? (
          <p className="mt-2 text-sm">Accepted by {q.acceptedByName} ({q.acceptedByEmail}) on {formatDateTime(q.acceptedAt)}. Our team will contact you to arrange the site survey.</p>
        ) : expired ? (
          <p className="mt-2 text-sm">This proposal expired on {formatDate(q.validUntil)}. Please contact {d.company.name}{contact && <> at {contact}</>} for an updated quotation.</p>
        ) : q.status !== "ISSUED" ? (
          <p className="mt-2 text-sm">This proposal can't be accepted online. Please contact {d.company.name}{contact && <> at {contact}</>}.</p>
        ) : (
          <div className="mt-3"><AcceptForm token={token} companyName={d.company.name} defaultName={d.project.customerName ?? ""} defaultEmail={d.project.customerEmail ?? ""} /></div>
        )}
      </section>

      <p className="text-xs text-ink-muted">Questions? {d.company.name}{contact && <> · {contact}</>}</p>
    </div>
  );
}
