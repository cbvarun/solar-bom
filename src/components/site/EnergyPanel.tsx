import type { EnergySummary } from "@/lib/energy-summary";
import { ESTIMATE_DISCLAIMER } from "@/lib/energy-summary";
import { formatINR } from "@/lib/format";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const kwh = (n: number) => `${n.toLocaleString("en-IN")} kWh`;

/** Monthly generation as bars, with the same numbers in a table for screen readers. */
export function MonthlyBars({ monthly }: { monthly: number[] }) {
  const max = Math.max(...monthly, 1);
  return (
    <figure className="mt-3">
      <div className="flex h-32 items-end gap-1" aria-hidden>
        {monthly.map((v, i) => (
          <div key={MONTHS[i]} className="group flex h-full flex-1 flex-col items-center justify-end" title={`${MONTHS[i]}: ${kwh(v)}`}>
            <div className="w-full max-w-6 rounded-t bg-solar-400 group-hover:bg-solar-500" style={{ height: `${(v / max) * 100}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1 text-[10px] text-ink-muted" aria-hidden>{MONTHS.map((m) => <span key={m} className="flex-1 text-center">{m[0]}</span>)}</div>
      <figcaption className="sr-only">Estimated monthly generation</figcaption>
      <table className="sr-only"><tbody>{monthly.map((v, i) => <tr key={MONTHS[i]}><th>{MONTHS[i]}</th><td>{kwh(v)}</td></tr>)}</tbody></table>
    </figure>
  );
}

export function EnergyPanel({ e, compact }: { e: EnergySummary; compact?: boolean }) {
  const s = e.savings;
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <section className="card p-5">
        <h2 className="section-title">Estimated generation</h2>
        {e.generation ? (
          <>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{kwh(e.generation.annualKwh)}<span className="text-sm font-normal text-ink-muted"> / year</span></p>
            <p className="mt-1 text-xs text-ink-muted">{e.generation.specificYieldKwhPerKwpYr} kWh per kWp per year · {e.generation.source}</p>
            {e.generation.monthlyKwh && <MonthlyBars monthly={e.generation.monthlyKwh} />}
          </>
        ) : <p className="mt-2 text-sm text-ink-muted">Not estimated. {e.generationNote}</p>}
      </section>
      <section className="card p-5">
        <h2 className="section-title">Savings and payback</h2>
        {s ? (
          <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 text-sm">
            <dt className="text-ink-muted">First-year bill savings</dt><dd className="num font-semibold">{formatINR(s.year1SavingsInr)}</dd>
            {s.totalSavingsInr != null && <><dt className="text-ink-muted">Savings over {s.projection!.length} years</dt><dd className="num">{formatINR(s.totalSavingsInr)}</dd></>}
            <dt className="text-ink-muted">Simple payback</dt><dd className="num">{s.simplePaybackYears != null ? `${s.simplePaybackYears} years` : "—"}</dd>
            <dt className="text-ink-muted">Tariff used</dt><dd className="num">₹{e.tariff?.inrPerKwh}/kWh</dd>
          </dl>
        ) : null}
        {e.savingsNote && <p className="mt-2 text-sm text-ink-muted">{e.savingsNote}</p>}
        {s && !compact && <ul className="mt-3 list-disc space-y-0.5 pl-4 text-xs text-ink-muted">{s.assumptions.map((a) => <li key={a}>{a}</li>)}{e.tariff?.source && <li>Tariff source: {e.tariff.source}</li>}</ul>}
      </section>
      <section className="card p-5">
        <h2 className="section-title">Price after subsidy</h2>
        <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 text-sm">
          <dt className="text-ink-muted">System price (incl. GST)</dt><dd className="num">{e.grossCostInr != null ? formatINR(e.grossCostInr) : "Pricing incomplete"}</dd>
          <dt className="text-ink-muted">Estimated subsidy</dt><dd className="num">{e.subsidy?.amountInr != null ? `− ${formatINR(e.subsidy.amountInr)}` : "—"}</dd>
          <dt className="font-medium">Net price</dt><dd className="num font-semibold">{e.netCostInr != null ? formatINR(e.netCostInr) : "—"}</dd>
        </dl>
        {e.subsidy ? (
          <p className="mt-2 text-xs text-ink-muted">{e.subsidy.basis}{!e.subsidy.verified && " Amounts are pending verification against the official notification."}{e.subsidy.sourceUrl && <> <a href={e.subsidy.sourceUrl} target="_blank" rel="noreferrer">Scheme source</a>.</>}</p>
        ) : <p className="mt-2 text-xs text-ink-muted">No subsidy applied.</p>}
      </section>
      {s?.projection && !compact && (
        <section className="card p-5 lg:col-span-3">
          <h2 className="section-title">Savings projection</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="table-tech table-compact">
              <thead><tr><th>Year</th><th className="num">Generation</th><th className="num">Savings</th><th className="num">Cumulative</th></tr></thead>
              <tbody>{s.projection.map((p) => <tr key={p.year}><td>{p.year}</td><td className="num">{kwh(p.kwh)}</td><td className="num">{formatINR(p.savingsInr)}</td><td className="num">{formatINR(p.cumulativeInr)}</td></tr>)}</tbody>
            </table>
          </div>
        </section>
      )}
      <p className="text-xs font-medium text-solar-700 lg:col-span-3">{ESTIMATE_DISCLAIMER}</p>
    </div>
  );
}
