"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

const KEY = "sb-compare";
type Sel = { sku: string; category: string }[];

function read(): Sel {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}
function write(v: Sel) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(v));
  } catch {}
  window.dispatchEvent(new Event("sb-compare"));
}
function useSel(): Sel {
  const [sel, setSel] = useState<Sel>([]);
  useEffect(() => {
    const f = () => setSel(read());
    f();
    window.addEventListener("sb-compare", f);
    return () => window.removeEventListener("sb-compare", f);
  }, []);
  return sel;
}

export function CompareToggle({ sku, category }: { sku: string; category: string }) {
  const sel = useSel();
  const on = sel.some((s) => s.sku === sku);
  const otherCat = sel.length > 0 && sel[0].category !== category;
  return (
    <label className={`flex items-center gap-1.5 text-xs ${otherCat ? "text-ink-faint" : "text-ink-muted"}`} title={otherCat ? "Compare items from one category at a time" : undefined}>
      <input type="checkbox" checked={on} disabled={(otherCat && !on) || (!on && sel.length >= 4)}
        onChange={() => write(on ? sel.filter((s) => s.sku !== sku) : [...sel, { sku, category }])} className="h-4 w-4 accent-brand-700" />
      Compare
    </label>
  );
}

export function CompareBar() {
  const sel = useSel();
  if (sel.length === 0) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 shadow-lg backdrop-blur">
      <div className="container-page flex items-center justify-between gap-3 py-3">
        <p className="text-sm">{sel.length} selected for comparison <span className="text-ink-muted">(max 4, same category)</span></p>
        <div className="flex gap-2">
          <button className="btn-ghost btn-sm" onClick={() => write([])}>Clear</button>
          <Link href={`/catalogue/compare?skus=${sel.map((s) => encodeURIComponent(s.sku)).join(",")}`} className={`btn-primary btn-sm ${sel.length < 2 ? "pointer-events-none opacity-50" : ""}`} aria-disabled={sel.length < 2}>Compare</Link>
        </div>
      </div>
    </div>
  );
}
