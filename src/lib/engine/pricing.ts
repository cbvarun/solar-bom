/**
 * Pricing: line subtotal = quantity × unit price; GST from the line's tax
 * classification. Prices may be entered inclusive or exclusive of GST.
 */
export interface PricedLineInput {
  id: string;
  section: string;
  quantity: number | null;
  unitPrice: number | null;
  gstRatePercent: number | null;
}

export interface PricedLine {
  id: string;
  section: string;
  subtotal: number | null; // excl. GST
  gst: number | null;
  total: number | null; // incl. GST
  priced: boolean;
  taxed: boolean;
}

export interface ExtraCost {
  label: string;
  amount: number | null;
  gstRatePercent: number | null;
}

export interface PricingResult {
  lines: PricedLine[];
  equipmentSubtotal: number;
  servicesSubtotal: number;
  extrasSubtotal: number;
  subtotalExGst: number;
  gstTotal: number;
  grandTotal: number;
  unpricedLines: number;
  untaxedLines: number;
  bySection: Record<string, { subtotal: number; gst: number; total: number }>;
  pricesIncludeGst: boolean;
  complete: boolean;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function priceLine(l: PricedLineInput, pricesIncludeGst: boolean): PricedLine {
  if (l.quantity == null || l.unitPrice == null) {
    return { id: l.id, section: l.section, subtotal: null, gst: null, total: null, priced: false, taxed: l.gstRatePercent != null };
  }
  const gross = l.quantity * l.unitPrice;
  if (l.gstRatePercent == null) {
    // GST classification unknown: show the amount but do not invent tax.
    return { id: l.id, section: l.section, subtotal: r2(gross), gst: null, total: r2(gross), priced: true, taxed: false };
  }
  const rate = l.gstRatePercent / 100;
  const subtotal = pricesIncludeGst ? gross / (1 + rate) : gross;
  const gst = subtotal * rate;
  return { id: l.id, section: l.section, subtotal: r2(subtotal), gst: r2(gst), total: r2(subtotal + gst), priced: true, taxed: true };
}

export function priceBom(lines: PricedLineInput[], extras: ExtraCost[], pricesIncludeGst: boolean): PricingResult {
  const priced = lines.map((l) => priceLine(l, pricesIncludeGst));
  const bySection: PricingResult["bySection"] = {};
  let equipment = 0, services = 0, gstTotal = 0;
  for (const p of priced) {
    if (!p.priced) continue;
    const s = (bySection[p.section] ??= { subtotal: 0, gst: 0, total: 0 });
    s.subtotal = r2(s.subtotal + (p.subtotal ?? 0));
    s.gst = r2(s.gst + (p.gst ?? 0));
    s.total = r2(s.total + (p.total ?? 0));
    if (p.section === "SERVICES") services += p.subtotal ?? 0;
    else equipment += p.subtotal ?? 0;
    gstTotal += p.gst ?? 0;
  }
  let extrasSub = 0;
  let extrasUntaxed = 0;
  for (const e of extras) {
    if (e.amount == null) continue;
    const pl = priceLine({ id: e.label, section: "EXTRAS", quantity: 1, unitPrice: e.amount, gstRatePercent: e.gstRatePercent }, pricesIncludeGst);
    extrasSub += pl.subtotal ?? 0;
    gstTotal += pl.gst ?? 0;
    if (!pl.taxed) extrasUntaxed++;
  }
  const subtotal = equipment + services + extrasSub;
  const unpricedLines = priced.filter((p) => !p.priced).length;
  const untaxedLines = priced.filter((p) => p.priced && !p.taxed).length + extrasUntaxed;
  return {
    lines: priced,
    equipmentSubtotal: r2(equipment),
    servicesSubtotal: r2(services),
    extrasSubtotal: r2(extrasSub),
    subtotalExGst: r2(subtotal),
    gstTotal: r2(gstTotal),
    grandTotal: r2(subtotal + gstTotal),
    unpricedLines,
    untaxedLines,
    bySection,
    pricesIncludeGst,
    complete: unpricedLines === 0 && untaxedLines === 0,
  };
}
