"use client";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface BarDatum { label: string; value: number; detail?: string }

const fmtInr = (v: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v);

/** Single-series horizontal bar chart (one hue, no legend) with a table fallback. */
export function HBarChart({ data, title, valueKind, emptyText }: { data: BarDatum[]; title: string; valueKind: "inr" | "count"; emptyText: string }) {
  const fmt = valueKind === "inr" ? fmtInr : (v: number) => String(v);
  if (!data.length) return <p className="py-8 text-center text-sm text-ink-muted">{emptyText}</p>;
  const height = Math.max(160, data.length * 30 + 30);
  return (
    <figure>
      <div style={{ height }} aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 8 }} barCategoryGap={6}>
            <CartesianGrid horizontal={false} stroke="#eef1ef" />
            <XAxis type="number" tickFormatter={(v) => (valueKind === "inr" ? `₹${Math.round(v / 1000)}k` : String(v))} tick={{ fontSize: 11, fill: "#5b6660" }} axisLine={false} tickLine={false} allowDecimals={false} />
            <YAxis type="category" dataKey="label" width={170} tick={{ fontSize: 11, fill: "#1d2521" }} axisLine={false} tickLine={false} />
            <Tooltip cursor={{ fill: "#f0f7f3" }} formatter={(v: number) => [fmt(v), title]} contentStyle={{ fontSize: 12, borderRadius: 6, borderColor: "#dcece2" }} />
            <Bar isAnimationActive={false} dataKey="value" fill="#2b6649" radius={[0, 4, 4, 0]} maxBarSize={18} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <details className="mt-2 text-xs">
        <summary className="cursor-pointer text-ink-muted">Table view</summary>
        <table className="table-tech table-compact mt-2">
          <thead><tr><th>Category</th><th className="num">{title}</th></tr></thead>
          <tbody>{data.map((d) => <tr key={d.label}><td>{d.label}</td><td className="num">{fmt(d.value)}{d.detail ? ` (${d.detail})` : ""}</td></tr>)}</tbody>
        </table>
      </details>
    </figure>
  );
}
